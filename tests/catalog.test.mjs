import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("../data/eventos-clientes-demo.json",import.meta.url),"utf8"));
const portal=await readFile(new URL("../index.html",import.meta.url),"utf8");
const admin=await readFile(new URL("../organizador.html",import.meta.url),"utf8");
test("los eventos ofrecidos en la tienda de demostración no suplantan carteles ni contratos reales",()=>{
 assert.ok(data.events.length>=8);
 assert.equal(new Set(data.events.map(e=>e.id)).size,data.events.length);
 assert.ok(data.organizers.length>=2);
 for(const e of data.events){
  assert.ok(data.organizers.some(o=>o.id===e.organizerId));
  assert.ok(e.title&&e.city&&e.venue&&e.date&&e.ticketTypes.length);
  assert.equal(e.posterUrl,null);
  assert.equal(e.status,"published");
  assert.ok(e.ticketTypes.every(t=>Number.isSafeInteger(t.priceClp)&&t.capacity>0));
 }
 assert.match(data.notice,/100% FICTICIOS/);
});
test("portal cuenta con selección y checkout transparente pero sin pasarela",()=>{
 assert.match(portal,/src\/marketplace\.mjs/);
 assert.match(portal,/checkout-backdrop/);
 assert.match(portal,/cargo/i);
 assert.match(portal,/sin dinero real/i);
 assert.doesNotMatch(portal,/www\.puntoticket\.com|www\.ticketmaster\.cl/);
 assert.match(admin,/src\/gestion\.mjs/);
 assert.match(admin,/id="new-event"/);
});
test("la consola distingue contrato, comisiones y liquidaciones simuladas",()=>{
 assert.match(admin,/Acuerdo comercial/);
 assert.match(admin,/Cargo/gi);
 assert.match(admin,/datos personales no se venden/i);
});
