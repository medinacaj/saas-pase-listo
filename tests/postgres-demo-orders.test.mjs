import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPostgresDemoOrders } from "../server/postgres-demo-orders.mjs";
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
  const reset = async () => {
    await poolA.query("TRUNCATE TABLE demo_orders, demo_ticket_stock RESTART IDENTITY CASCADE");
  };
  const a = createPostgresDemoOrders({ pool: poolA, catalog });
  const b = createPostgresDemoOrders({ pool: poolB, catalog });
  await reset();
  await Promise.all([a.initialize(), b.initialize()]);

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
});
