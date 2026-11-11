import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPostgresDemoOrders } from "../server/postgres-demo-orders.mjs";
import { createPostgresDemoAuth } from "../server/postgres-demo-auth.mjs";
import { buildBuyerServer } from "../server/buyer-server.mjs";

const dbUrl = process.env.PASELISTO_DEMO_DATABASE_URL;
const catalog = JSON.parse(await readFile(new URL("../data/eventos-clientes-demo.json", import.meta.url), "utf8"));

test("PostgreSQL DEMO: transacciones entre conexiones, idempotencia y ruta HTTP real",
 { skip: !dbUrl }, async t => {
  const { default: pg } = await import("pg");
  const poolA = new pg.Pool({ connectionString: dbUrl, max: 6 });
  const poolB = new pg.Pool({ connectionString: dbUrl, max: 6 });
  t.after(async () => { await Promise.all([poolA.end(), poolB.end()]); });
  const migration = await readFile(new URL("../db/001_demo_inventory_orders.sql", import.meta.url), "utf8");
  await poolA.query(migration);
  const limitMigration = await readFile(new URL("../db/004_demo_max_tickets_per_buyer.sql", import.meta.url), "utf8");
  await poolA.query(limitMigration);
  const queueMigration=await readFile(new URL("../db/005_demo_waitlist.sql",import.meta.url),"utf8");
  await poolA.query(queueMigration);
  const reset = async () => {
    await poolA.query("TRUNCATE TABLE demo_waitlist, demo_orders, demo_ticket_stock RESTART IDENTITY CASCADE");
  };
  const a = createPostgresDemoOrders({ pool: poolA, catalog });
  const b = createPostgresDemoOrders({ pool: poolB, catalog });
  await reset();
  await Promise.all([a.initialize(), b.initialize()]);

  await t.test("límite de 7 por comprador acumula categorías y resiste pedidos simultáneos",async()=>{
    await reset();
    await Promise.all([a.initialize(),b.initialize()]);
    const buyerId="buyer-22222222-2222-4222-8222-222222222222";
    const first=await a.create({buyerId,eventId:"demo-noches-aurora",
      ticketTypeId:"general",quantity:4,requestId:"limit-test-first-001"});
    assert.equal(first.quantity,4);
    await assert.rejects(b.create({buyerId,eventId:"demo-noches-aurora",
      ticketTypeId:"vip",quantity:4,requestId:"limit-test-too-many-002"}),
      error=>error.status===409 && /Límite máximo/.test(error.message));
    const second=await b.create({buyerId,eventId:"demo-noches-aurora",
      ticketTypeId:"vip",quantity:3,requestId:"limit-test-remaining-003"});
    assert.equal(second.quantity,3);
    await assert.rejects(a.create({buyerId,eventId:"demo-noches-aurora",
      ticketTypeId:"general",quantity:1,requestId:"limit-test-over-004"}),error=>error.status===409);
    const repeat=await b.create({buyerId,eventId:"demo-noches-aurora",
      ticketTypeId:"general",quantity:4,requestId:"limit-test-first-001"});
    assert.equal(repeat.id,first.id,"Reintento idempotente permitido aunque el usuario alcanzó el límite");
    const buyerTwo="buyer-33333333-3333-4333-8333-333333333333";
    const parallel=await Promise.all([
      a.create({buyerId:buyerTwo,eventId:"demo-noches-aurora",
        ticketTypeId:"general",quantity:7,requestId:"limit-parallel-order-001"}).then(()=>true).catch(()=>false),
      b.create({buyerId:buyerTwo,eventId:"demo-noches-aurora",
        ticketTypeId:"vip",quantity:7,requestId:"limit-parallel-order-002"}).then(()=>true).catch(()=>false)
    ]);
    assert.equal(parallel.filter(Boolean).length,1,"Solo un pedido puede pasar el límite acumulado");
  });

  await t.test("cola masiva FIFO entre dos pools no se puede saltar con pedidos HTTP directos",async()=>{
    await reset();
    await Promise.all([a.initialize(),b.initialize()]);
    const massive="demo-festival-masivo-2027";
    const buyerAt=n=>"buyer-"+String(n).padStart(8,"0")+"-2222-4222-8222-"+String(n).padStart(12,"0");
    const first=buyerAt(1);
    await assert.rejects(a.create({buyerId:first,eventId:massive,ticketTypeId:"general",
      quantity:1,requestId:"queue-bypass-attempt-0001"}),e=>e.status===409&&/turno/.test(e.message));
    const entrants=await Promise.all(Array.from({length:27},(_,i)=>
      (i%2?a:b).joinWaitingRoom({eventId:massive,buyerId:buyerAt(i+1)})));
    assert.equal(entrants.filter(x=>x.status==="admitted").length,25);
    const pos26=await a.waitlistStatus({eventId:massive,buyerId:buyerAt(26)});
    const pos27=await b.waitlistStatus({eventId:massive,buyerId:buyerAt(27)});
    assert.equal(pos26.status,"waiting");
    assert.equal(pos26.position,1);
    assert.equal(pos27.position,2);
    const repeat=await b.joinWaitingRoom({eventId:massive,buyerId:buyerAt(27)});
    assert.equal(repeat.position,2);
    await assert.rejects(b.create({buyerId:buyerAt(27),eventId:massive,ticketTypeId:"general",
      quantity:1,requestId:"queue-bypass-waiting-0002"}),e=>e.status===409);
    const order=await a.create({buyerId:first,eventId:massive,ticketTypeId:"general",
      quantity:4,requestId:"queue-admitted-order-0001"});
    assert.equal(order.quantity,4);
    assert.equal((await a.waitlistStatus({eventId:massive,buyerId:first})).status,"used");
    assert.equal((await b.waitlistStatus({eventId:massive,buyerId:buyerAt(26)})).status,"admitted");
    const retry=await b.create({buyerId:first,eventId:massive,ticketTypeId:"general",
      quantity:4,requestId:"queue-admitted-order-0001"});
    assert.equal(retry.id,order.id);
    await assert.rejects(b.create({buyerId:first,eventId:massive,ticketTypeId:"general",
      quantity:1,requestId:"queue-no-second-turn-0003"}),e=>e.status===409);
    await b.joinWaitingRoom({eventId:massive,buyerId:first});
    const second=await b.create({buyerId:first,eventId:massive,ticketTypeId:"general",
      quantity:3,requestId:"queue-second-admission-0004"});
    assert.equal(second.quantity,3);
    await assert.rejects(a.joinWaitingRoom({eventId:massive,buyerId:first}),
      e=>e.status===409 && /máximo/.test(e.message));
    const sold=await poolA.query("SELECT sold FROM demo_ticket_stock WHERE event_id=$1 AND ticket_type_id='general'",[massive]);
    assert.equal(Number(sold.rows[0].sold),7);
  });

  await t.test("ocho pedidos paralelos no superan dos entradas, aun entre pools", async () => {
    await poolA.query(
      "UPDATE demo_ticket_stock SET capacity = 2 WHERE event_id = $1 AND ticket_type_id = $2",
      ["demo-noches-aurora", "general"]
    );
    const buyerId = "buyer-11111111-1111-4111-8111-111111111111";
    const results = await Promise.all(Array.from({length:8}, (_, i) =>
      (i % 2 ? b : a).create({
        buyerId, eventId:"demo-noches-aurora",ticketTypeId:"general",
        quantity:1,requestId:"postgres-parallel-"+String(i).padStart(4,"0")
      }).then(order => ({ok:true,order})).catch(err=>({ok:false,status:err.status}))
    ));
    const successes=results.filter(result=>result.ok);
    assert.equal(successes.length,2);
    assert.equal(results.filter(result=>result.status===409).length,6);
    assert.equal(new Set(successes.map(result=>result.order.id)).size,2);
    const stock=await poolA.query(
      "SELECT capacity, sold FROM demo_ticket_stock WHERE event_id=$1 AND ticket_type_id=$2",
      ["demo-noches-aurora","general"]
    );
    assert.deepEqual([stock.rows[0].capacity,stock.rows[0].sold],[2,2]);

    const saved=successes[0].order;
    const retry=await b.create({
      buyerId,eventId:saved.eventId,ticketTypeId:saved.ticketTypeId,
      quantity:saved.quantity,requestId:saved.requestId
    });
    assert.equal(retry.id,saved.id);
    await assert.rejects(
      a.create({buyerId,eventId:saved.eventId,ticketTypeId:saved.ticketTypeId,
        quantity:2,requestId:saved.requestId}),
      error=>error.status===409
    );
    const count=await poolA.query("SELECT count(*)::int AS count FROM demo_orders");
    assert.equal(count.rows[0].count,2);
    const inventory=await a.inventory();
    const type=inventory.find(e=>e.eventId==="demo-noches-aurora")
      .ticketTypes.find(t=>t.ticketTypeId==="general");
    assert.equal(type.remaining,0);
    assert.equal(type.unitBaseClp,15000);
    assert.equal(type.feePerTicketClp,2000);
  });

  await t.test("dos pools reutilizan la misma solicitud simultánea sin duplicar ventas", async () => {
    await reset();
    await Promise.all([a.initialize(), b.initialize()]);
    await poolA.query(
      "UPDATE demo_ticket_stock SET capacity=1 WHERE event_id=$1 AND ticket_type_id=$2",
      ["demo-noches-aurora","general"]
    );
    const request={
      buyerId:"buyer-33333333-3333-4333-8333-333333333333",
      eventId:"demo-noches-aurora",ticketTypeId:"general",
      quantity:1,requestId:"postgres-same-key-0001"
    };
    const responses=await Promise.all(
      Array.from({length:10},(_,i)=>(i%2?b:a).create(request))
    );
    assert.equal(new Set(responses.map(o=>o.id)).size,1);
    assert.equal(new Set(responses.map(o=>o.requestId)).size,1);
    const persisted=await poolA.query(
      "SELECT sold FROM demo_ticket_stock WHERE event_id=$1 AND ticket_type_id=$2",
      [request.eventId,request.ticketTypeId]
    );
    assert.equal(persisted.rows[0].sold,1);
    const count=await poolB.query(
      "SELECT count(*)::int AS total FROM demo_orders WHERE buyer_id=$1",
      [request.buyerId]
    );
    assert.equal(count.rows[0].total,1);
    await assert.rejects(
      b.create({...request,quantity:2}),
      error=>error.status===409
    );
  });

  await t.test("sesión HTTP utiliza PostgreSQL y el historial aísla los compradores", async t => {
    await reset();
    await Promise.all([a.initialize(),b.initialize()]);
    const dir=await mkdtemp(join(tmpdir(),"paselisto-pg-buyers-"));
    const {server,ready}=buildBuyerServer({
      filePath:join(dir,"buyer.json"),ordersBackend:a
    });
    await ready;
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    t.after(async()=>{
      await new Promise(resolve=>server.close(resolve));
      await rm(dir,{recursive:true,force:true});
    });
    const origin="http://127.0.0.1:"+server.address().port;
    async function request(path,{method="GET",cookie="",body}={}){
      const res=await fetch(origin+"/api/buyer/"+path,{
        method,headers:{
          ...(cookie?{Cookie:cookie}:{}),
          ...(method==="POST"?{
            "Content-Type":"application/json","X-PaseListo-Request":"1",Origin:origin
          }:{})
        },...(body?{body:JSON.stringify(body)}:{})
      });
      return {status:res.status,data:await res.json(),
        cookie:res.headers.get("set-cookie")?.split(";")[0]||""};
    }
    const first=await request("register",{method:"POST",body:{
      email:"pg-buyer-a@example.test",password:"Clave-Postgres-Demo-123456"
    }});
    const second=await request("register",{method:"POST",body:{
      email:"pg-buyer-b@example.test",password:"Clave-Postgres-Demo-654321"
    }});
    assert.equal(first.status,201);
    assert.equal(second.status,201);
    const body={eventId:"demo-noches-aurora",ticketTypeId:"general",
      quantity:2,requestId:"pg-http-order-0001"};
    const purchase=await request("orders",{method:"POST",cookie:first.cookie,body});
    assert.equal(purchase.status,201);
    assert.equal(purchase.data.pricing.totalClp,34000);
    assert.equal(purchase.data.pricing.platformShareClp,undefined);
    const retry=await request("orders",{method:"POST",cookie:first.cookie,body});
    assert.equal(retry.status,201);
    assert.equal(retry.data.id,purchase.data.id);
    const history=await request("orders",{cookie:first.cookie});
    assert.equal(history.data.orders.length,1);
    const other=await request("orders",{cookie:second.cookie});
    assert.deepEqual(other.data.orders,[]);
    assert.equal((await request("orders")).status,401);
    const stock=await request("inventory");
    const remaining=stock.data.events.find(e=>e.eventId==="demo-noches-aurora")
      .ticketTypes.find(t=>t.ticketTypeId==="general").remaining;
    const dbStock=await poolB.query(
      "SELECT capacity - sold AS remaining FROM demo_ticket_stock WHERE event_id=$1 AND ticket_type_id=$2",
      ["demo-noches-aurora","general"]
    );
    assert.equal(remaining,dbStock.rows[0].remaining);
    const dbOrders=await poolB.query("SELECT count(*)::int AS count FROM demo_orders");
    assert.equal(dbOrders.rows[0].count,1);
  });

  await t.test("cuentas y sesiones SQL compartidas entre dos servidores locales", async t => {
    const authMigration = await readFile(new URL("../db/002_demo_buyers_sessions.sql", import.meta.url), "utf8");
    await poolA.query(authMigration);
    const attemptsMigration = await readFile(new URL("../db/003_demo_shared_login_limits.sql", import.meta.url), "utf8");
    await poolA.query(attemptsMigration);
    await poolA.query("TRUNCATE TABLE demo_buyer_login_attempts, demo_buyer_sessions, demo_buyers, demo_orders, demo_ticket_stock RESTART IDENTITY CASCADE");
    await Promise.all([a.initialize(), b.initialize()]);
    const dir = await mkdtemp(join(tmpdir(), "paselisto-pg-shared-auth-"));
    const fileA = join(dir, "a.json"), fileB = join(dir, "b.json");
    const authA = createPostgresDemoAuth({ pool: poolA });
    const authB = createPostgresDemoAuth({ pool: poolB });
    const appA = buildBuyerServer({ filePath: fileA, ordersBackend: a, authBackend: authA });
    const appB = buildBuyerServer({ filePath: fileB, ordersBackend: b, authBackend: authB });
    await Promise.all([appA.ready, appB.ready]);
    for (const app of [appA, appB]) {
      await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
    }
    t.after(async () => {
      await Promise.all([appA, appB].map(app => new Promise(resolve => app.server.close(resolve))));
      await rm(dir, { recursive: true, force: true });
    });
    const originA = "http://127.0.0.1:" + appA.server.address().port;
    const originB = "http://127.0.0.1:" + appB.server.address().port;
    async function request(origin, path, { method = "GET", cookie = "", body } = {}) {
      const response = await fetch(origin + "/api/buyer/" + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method === "POST" ? {
            "Content-Type": "application/json", "X-PaseListo-Request": "1", Origin: origin
          } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      return {
        status: response.status, data: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0] || ""
      };
    }

    const user = { email: "pg-shared@example.test", password: "Demo-Only-Shared-Passphrase-123" };
    const created = await request(originA, "register", { method: "POST", body: user });
    assert.equal(created.status, 201);
    assert.match(created.cookie, /^pl_session=[0-9a-f]{64}$/);
    assert.equal((await request(originB, "session", { cookie: created.cookie })).data.authenticated, true);
    const duplicate = await request(originB, "register", { method: "POST", body: user });
    assert.equal(duplicate.status, 409);

    const orderInput = { eventId: "demo-noches-aurora", ticketTypeId: "general",
      quantity: 1, requestId: "pg-shared-auth-0001" };
    const ordered = await request(originB, "orders", {
      method: "POST", cookie: created.cookie, body: orderInput
    });
    assert.equal(ordered.status, 201);
    assert.equal((await request(originA, "orders", { cookie: created.cookie })).data.orders.length, 1);
    const other = await request(originB, "register", {
      method: "POST",
      body: { email: "pg-shared-other@example.test", password: "Demo-Only-Other-Passphrase-123" }
    });
    assert.equal(other.status, 201);
    assert.deepEqual((await request(originA, "orders", { cookie: other.cookie })).data.orders, []);

    const stored = await poolA.query("SELECT id, email, salt, digest FROM demo_buyers WHERE email = $1", [user.email]);
    assert.equal(stored.rows.length, 1);
    assert.notEqual(stored.rows[0].digest, user.password);
    assert.equal(stored.rows[0].digest.length, 128);
    const sessions = await poolB.query("SELECT token_hash FROM demo_buyer_sessions");
    assert.ok(sessions.rows.length >= 2);
    assert.ok(sessions.rows.every(row => /^[0-9a-f]{64}$/.test(row.token_hash)));
    assert.ok(sessions.rows.every(row => row.token_hash !== created.cookie.slice("pl_session=".length)));
    await assert.rejects(readFile(fileA, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(fileB, "utf8"), { code: "ENOENT" });

    const logout = await request(originB, "logout", {
      method: "POST", cookie: created.cookie, body: {}
    });
    assert.equal(logout.status, 200);
    assert.equal((await request(originA, "session", { cookie: created.cookie })).data.authenticated, false);
    assert.equal((await request(originA, "orders", { cookie: created.cookie })).status, 401);

    const login = await request(originB, "login", { method: "POST", body: user });
    assert.equal(login.status, 200);
    assert.equal((await request(originA, "session", { cookie: login.cookie })).data.authenticated, true);
    assert.equal((await request(originA, "orders", { cookie: login.cookie })).data.orders.length, 1);
    const wrongCredentials = { email: user.email, password: "Not-The-Actual-Password-123" };
    for (let i = 0; i < 8; i++) {
      const origin = i % 2 ? originA : originB;
      const denied = await request(origin, "login", { method: "POST", body: wrongCredentials });
      assert.equal(denied.status, 401);
    }
    const blocked = await request(originA, "login", { method: "POST", body: user });
    assert.equal(blocked.status, 429);
    // Simulate expiry of the rate-limit window without clock manipulation.
    await poolA.query(
      "UPDATE demo_buyer_login_attempts SET reset_at = now() - interval '1 minute' WHERE email = $1",
      [user.email]
    );
    const recovered = await request(originB, "login", { method: "POST", body: user });
    assert.equal(recovered.status, 200);
    assert.equal((await request(originA, "session", { cookie: recovered.cookie })).data.authenticated, true);
    const cleared = await poolB.query(
      "SELECT count(*)::int AS n FROM demo_buyer_login_attempts WHERE email = $1",
      [user.email]
    );
    assert.equal(cleared.rows[0].n, 0);

    const concurrent = await Promise.all(Array.from({length:12},(_,i) =>
      request(i % 2 ? originA : originB, "login", {
        method: "POST", body: wrongCredentials
      })
    ));
    assert.equal(concurrent.filter(result=>result.status===401).length,8);
    assert.equal(concurrent.filter(result=>result.status===429).length,4);

    const duplicateBuyer = { email: "pg-same-register@example.test", password: "Same-Registration-Passphrase-123" };
    const registrations = await Promise.all([
      request(originA, "register", { method: "POST", body: duplicateBuyer }),
      request(originB, "register", { method: "POST", body: duplicateBuyer })
    ]);
    assert.deepEqual(registrations.map(result=>result.status).sort(),[201,409]);
    const oneBuyer = await poolA.query(
      "SELECT count(*)::int AS n FROM demo_buyers WHERE email = $1",
      [duplicateBuyer.email]
    );
    assert.equal(oneBuyer.rows[0].n,1);
  });

});
