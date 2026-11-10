import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=async path=>readFile(new URL(path,import.meta.url),"utf8");
const demo=JSON.parse(await read("../data/eventos-clientes-demo.json"));
const refs=JSON.parse(await read("../data/eventos-reales-referencia.json"));
const portal=await read("../index.html");
const admin=await read("../admin.html");
const former=await read("../organizador.html");
const marketplace=await read("../src/marketplace.mjs");

test("ocho eventos ficticios permiten únicamente pedidos DEMO",()=>{
 assert.ok(demo.events.length>=8);
 assert.equal(new Set(demo.events.map(e=>e.id)).size,demo.events.length);
 for(const e of demo.events){
  assert.ok(demo.organizers.some(o=>o.id===e.organizerId));
  assert.ok(e.ticketTypes.length&&e.status==="published");
  assert.ok(e.ticketTypes.every(t=>Number.isSafeInteger(t.priceClp)&&t.capacity>0));
  assert.equal(e.posterRights,"demo");
 }
 assert.match(demo.notice,/100% FICTICIOS/);
});
test("6 eventos reales tienen afiches promocionales con fuentes y no tienen venta ni aforo PaseListo",()=>{
 assert.ok(refs.events.length>=6);
 const hosts=new Set(["dgmedios.com","www.puntoticket.com","www.cirquedusoleil.com"]);
 for(const e of refs.events){
  assert.match(e.id,/^ref-/);
  assert.ok(e.title&&e.date&&e.city&&e.venue);
  assert.equal(new URL(e.posterUrl).protocol,"https:");
  assert.ok(hosts.has(new URL(e.sourceUrl).hostname));
  assert.equal(new URL(e.posterSourceUrl).protocol,"https:");
  assert.ok(e.posterCredit);
  assert.equal(Object.hasOwn(e,"ticketTypes"),false);
  assert.equal(Object.hasOwn(e,"priceClp"),false);
  assert.equal(Object.hasOwn(e,"saleEnabled"),false);
 }
 assert.match(refs.purpose,/NO.*contratado|Ninguno está contratado/i);
});
test("portal muestra cartel real de referencia, pero no le ofrece checkout",()=>{
 assert.match(portal,/real-events-grid/);
 assert.match(portal,/checkout-backdrop/);
 assert.match(marketplace,/Cargo por servicio/i);
 assert.match(marketplace,/function realPoster/);
 assert.match(marketplace,/NO A LA VENTA EN PASELISTO/);
 assert.match(marketplace,/function openRealDetail/);
 assert.match(marketplace,/function openCheckout/);
 assert.match(marketplace,/sin contrato/i);
});
test("el acceso administrativo es de control CENTRAL y la página empresarial anterior redirige",()=>{
 assert.match(admin,/CONTROL CENTRAL/);
 assert.match(admin,/TODOS LOS ORGANIZADORES/);
 assert.match(admin,/Productores y recintos/);
 assert.match(admin,/admin control|Centro de Control/i);
 assert.match(admin,/src\/control\.mjs/);
 assert.doesNotMatch(admin,/src\/gestion\.mjs/);
 assert.match(admin,/VERSIÓN PÚBLICA Y SIN LOGIN/);
 assert.match(former,/url=\.\/admin\.html/);
});
