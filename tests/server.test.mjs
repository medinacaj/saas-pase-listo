import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../server/index.mjs";

const keys = { "org-andes": "test-key-andes-0123456789-abcdef", "org-oriente": "test-key-oriente-0123456789-abcdef" };
async function runServer(t) {
  const dir = await mkdtemp(join(tmpdir(), "paselisto-test-"));
  const db = join(dir, "state.json");
  const app = buildServer({ tokens: keys, filePath: db });
  await app.ready;
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise((resolve) => app.server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const url = "http://127.0.0.1:" + app.server.address().port;
  const call = async (path, token, data, key) => {
    const res = await fetch(url + path, { method: data ? "POST" : "GET", headers: { Authorization: token ? "Bearer " + keys[token] : "", "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  return { call, db, url };
}
test("API exige token y separa entradas de las dos productoras", async (t) => {
  const { call } = await runServer(t);
  assert.equal((await call("/api/v1/snapshot")).status, 401);
  const entry = await call("/api/v1/tickets", "org-andes", { eventId: "evt-a1", alias: "Invitado Demo" }, "invoice-demo-0001");
  assert.equal(entry.status, 201);
  assert.equal((await call("/api/v1/snapshot", "org-oriente")).body.tickets.length, 0);
  assert.equal((await call("/api/v1/checkins", "org-oriente", { code: entry.body.code })).status, 404);
  assert.equal((await call("/api/v1/checkins", "org-andes", { code: entry.body.code })).status, 201);
  assert.equal((await call("/api/v1/checkins", "org-andes", { code: entry.body.code })).status, 409);
});
test("idempotencia y estado serializado no duplican venta", async (t) => {
  const { call } = await runServer(t);
  const payload = { eventId: "evt-a1", alias: "Invitado Demo" };
  const concurrent = await Promise.all([call("/api/v1/tickets", "org-andes", payload, "request-0000001"), call("/api/v1/tickets", "org-andes", payload, "request-0000001")]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 201]);
  assert.equal((await call("/api/v1/snapshot", "org-andes")).body.tickets.length, 1);
  assert.equal((await call("/api/v1/tickets", "org-andes", { ...payload, alias: "Other" }, "request-0000001")).status, 409);
});
