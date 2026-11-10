import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCheckoutState } from "../src/checkout-state.mjs";

test("un reintento del mismo formulario DEMO conserva la misma clave", () => {
 let count = 0;
 const makeId = () => "checkout-" + ++count;
 const first = createCheckoutState(null, "event-a", "general", 2, makeId);
 const retry = createCheckoutState(first, "event-a", "general", 2, makeId);
 assert.equal(retry.requestId, first.requestId);
 assert.equal(count, 1);
 assert.equal(retry.submitting, false);
});
test("cambiar selección o iniciar otra compra crea una solicitud nueva", () => {
 let count = 0;
 const makeId = () => "checkout-" + ++count;
 const first = createCheckoutState(null, "event-a", "general", 1, makeId);
 const differentQty = createCheckoutState(first, "event-a", "general", 2, makeId);
 const differentType = createCheckoutState(differentQty, "event-a", "vip", 2, makeId);
 const differentEvent = createCheckoutState(differentType, "event-b", "vip", 2, makeId);
 const reopened = createCheckoutState(null, "event-a", "general", 1, makeId);
 assert.equal(new Set([first,differentQty,differentType,differentEvent,reopened].map(x=>x.requestId)).size, 5);
});
test("la compra desde la interfaz reutiliza la clave y bloquea doble envío", async () => {
 const code = await readFile(new URL("../src/marketplace.mjs", import.meta.url), "utf8");
 assert.match(code, /requestId:checkout\.requestId/);
 assert.match(code, /if\(!checkout\|\|checkout\.submitting\)return/);
 assert.match(code, /checkout\.submitting=true/);
 assert.doesNotMatch(code, /requestId:\s*crypto\.randomUUID\(\)/);
});
test("Mi cuenta presenta el historial privado y permite cerrar sesión", async () => {
 const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
 const code = await readFile(new URL("../src/marketplace.mjs", import.meta.url), "utf8");
 assert.match(page, /id="orders-backdrop"/);
 assert.match(page, /id="buyer-orders-content"/);
 assert.match(page, /id="buyer-logout"/);
 assert.match(code, /buyerRequest\("orders",undefined,"GET"\)/);
 assert.match(code, /buyerRequest\("logout",\{\}\)/);
});

test("la cartelera consulta aforo del servidor DEMO y desactiva compras sin cupos", async () => {
 const code = await readFile(new URL("../src/marketplace.mjs", import.meta.url), "utf8");
 assert.match(code, /buyerRequest\("inventory",undefined,"GET"\)/);
 assert.match(code, /remainingFor\(event\.id,t\.id\)/);
 assert.match(code, /insufficient\?'disabled':''/);
});
