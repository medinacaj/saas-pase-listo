import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMarketplaceServer } from "../server/marketplace-api.mjs";

const tokens = {
 "org-aurora": "dev-secret-aurora-abcdef1234567890",
 "org-escena": "dev-secret-escena-abcdef1234567890",
 "org-nexo": "dev-secret-nexo-abcdef1234567890"
};
async function setup(t) {
 const dir = await mkdtemp(join(tmpdir(), "paselisto-market-"));
 const { server, ready } = buildMarketplaceServer({ tokens, filePath: join(dir, "state.json") });
 await ready;
 await new Promise(done => server.listen(0, "127.0.0.1", done));
 t.after(async () => { await new Promise(done => server.close(done)); await rm(dir, { recursive: true, force: true }); });
 const base = "http://127.0.0.1:" + server.address().port;
 return async (path, tenant, data) => {
  const response = await fetch(base + path, {
   method: data ? "POST" : "GET",
   headers: { Authorization: tenant ? "Bearer " + tokens[tenant] : "", "Content-Type": "application/json" },
   ...(data ? { body: JSON.stringify(data) } : {})
  });
  return { status: response.status, body: await response.json() };
 };
}
test("la API del organizador no permite emitir órdenes sin una sesión del comprador", async t => {
 const call = await setup(t);
 assert.equal((await call("/api/v1/snapshot")).status, 401);
 const event = { title: "Evento de prueba", venue: "Recinto DEMO", city: "Concepción", date: "2027-06-10", time: "19:00", category: "Música", priceClp: 15000, capacity: 1, description: "Evento de prueba solo para administración" };
 const created = await call("/api/v1/market/events", "org-escena", event);
 assert.equal(created.status, 201);
 assert.equal((await call("/api/v1/snapshot", "org-aurora")).body.events.some(e => e.id === created.body.id), false);
 for (const tenant of ["org-escena", "org-aurora"]) {
  const forbidden = await call("/api/v1/market/orders", tenant, { eventId: created.body.id, ticketTypeId: "general", quantity: 1, buyerId: "buyer-forged-id" });
  assert.equal(forbidden.status, 404);
 }
 assert.equal((await call("/api/v1/snapshot", "org-escena")).body.orders.length, 0);
});
