import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBuyerServer } from "../server/buyer-server.mjs";

async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), "paselisto-buyers-"));
 const filePath = join(dir, "state.json");
 const { server, ready } = buildBuyerServer({ filePath });
 await ready;
 await new Promise(done => server.listen(0, "127.0.0.1", done));
 t.after(async () => {
  await new Promise(done => server.close(done));
  await rm(dir, { recursive: true, force: true });
 });
 const origin = "http://127.0.0.1:" + server.address().port;
 const request = async (path, { cookie = "", method = "GET", body, originHeader = origin, header = "1" } = {}) => {
  const resp = await fetch(origin + "/api/buyer/" + path, {
   method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method === "POST" ? { "Content-Type": "application/json", "X-PaseListo-Request": header, ...(originHeader === null ? {} : { Origin: originHeader }) } : {}) },
   ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: resp.status, data: await resp.json(), cookie: resp.headers.get("set-cookie")?.split(";")[0] || "" };
 };
 return { request, filePath, origin };
}
test("sin sesión no se puede crear un pedido; no existe el alias ficticio", async t => {
 const { request } = await fixture(t);
 assert.equal((await request("status")).data.ready, true);
 assert.equal((await request("session")).data.authenticated, false);
 const order = await request("orders", { method: "POST", body: { eventId: "demo-noches-aurora", ticketTypeId: "general", quantity: 1, requestId: "request-unauthorized-001" } });
 assert.equal(order.status, 401);
 assert.match(order.data.error, /iniciar sesión/);
});
test("registro con contraseña robusta, login, cookie HttpOnly y logout", async t => {
 const { request, filePath } = await fixture(t);
 const email = "comprador-demo@example.test", password = "SoloPruebas-12345-clave";
 const invalid = await request("register", { method: "POST", body: { email, password: "abc" } });
 assert.equal(invalid.status, 422);
 const reg = await request("register", { method: "POST", body: { email, password } });
 assert.equal(reg.status, 201);
 assert.match(reg.cookie, /^pl_session=/);
 assert.equal(reg.data.buyer.email, email);
 const saved = await readFile(filePath, "utf8");
 assert.equal(saved.includes(password), false);
 assert.equal(saved.includes("digest"), true);
 const s = await request("session", { cookie: reg.cookie });
 assert.equal(s.data.authenticated, true);
 const loggedOut = await request("logout", { method: "POST", cookie: reg.cookie, body: {} });
 assert.equal(loggedOut.status, 200);
 assert.equal((await request("session", { cookie: reg.cookie })).data.authenticated, false);
 assert.equal((await request("login", { method: "POST", body: { email, password: "LaIncorrecta12345" } })).status, 401);
 const login = await request("login", { method: "POST", body: { email, password } });
 assert.equal(login.status, 200);
 assert.equal((await request("session", { cookie: login.cookie })).data.authenticated, true);
});
test("cada compra DEMO requiere sesión, respeta inventario e idempotencia", async t => {
 const { request } = await fixture(t);
 const register = await request("register", { method: "POST", body: { email: "usuario-demo@example.test", password: "Prueba-Unica-123456789" } });
 const cookie = register.cookie;
 const order = { eventId: "demo-noches-aurora", ticketTypeId: "general", quantity: 2, requestId: "idem-order-0001" };
 const first = await request("orders", { method: "POST", cookie, body: order });
 assert.equal(first.status, 201);
 assert.equal(first.data.quantity, 2);
 assert.equal(first.data.alias, undefined);
 assert.equal(first.data.buyerId, register.data.buyer.id);
 const retry = await request("orders", { method: "POST", cookie, body: order });
 assert.equal(retry.status, 201);
 assert.equal(retry.data.id, first.data.id);
 const conflict = await request("orders", { method: "POST", cookie, body: { ...order, quantity: 3 } });
 assert.equal(conflict.status, 409);
 const second = await request("register", { method: "POST", body: { email: "otro-demo@example.test", password: "Otra-Prueba-123456789" } });
 const forged = await request("orders", { method: "POST", cookie: second.cookie, body: { ...order, requestId: "idem-order-0002", buyerId: register.data.buyer.id } });
 assert.equal(forged.status, 201);
 assert.equal(forged.data.buyerId, second.data.buyer.id);
});
test("protección CSRF: rechaza origen externo y ausencia del encabezado exigido", async t => {
 const { request } = await fixture(t);
 const body = { email: "muestra@example.test", password: "Prueba-Hipotetica-123456789" };
 assert.equal((await request("register", { method: "POST", body, originHeader: "http://example.com" })).status, 403);
 assert.equal((await request("register", { method: "POST", body, header: "" })).status, 403);
});

test("servidor de compradores entrega el sistema visual compartido", async t => {
 const { origin } = await fixture(t);
 const response = await fetch(origin + "/src/brand-system.css");
 assert.equal(response.status, 200);
 assert.match(response.headers.get("content-type"), /text\/css/);
 assert.match(await response.text(), /--pl-lime/);
});

test("protección CSRF: rechaza POST sin Origin aunque tenga encabezado personalizado", async t => {
 const { request } = await fixture(t);
 const response = await request("register", {
  method: "POST", originHeader: null,
  body: { email: "sin-origen@example.test", password: "Contrasena-Larga-123456" }
 });
 assert.equal(response.status, 403);
});
