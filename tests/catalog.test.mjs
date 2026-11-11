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
test("eventos externos mantienen fuentes contrastables sin ventas ni afiches obligatorios",()=>{
 assert.ok(refs.events.length>=6);
 const hosts=new Set(["dgmedios.com","www.puntoticket.com","www.cirquedusoleil.com","www.todoenconce.cl"]);
 const ids=new Set();
 for(const e of refs.events){
  assert.match(e.id,/^ref-/);
  assert.ok(!ids.has(e.id),"ID de referencia duplicado: "+e.id);
  ids.add(e.id);
  assert.ok(e.title&&e.date&&e.city&&e.venue);
  assert.ok(hosts.has(new URL(e.sourceUrl).hostname));
  if(e.posterUrl)assert.equal(new URL(e.posterUrl).protocol,"https:");
  if(e.posterSourceUrl)assert.equal(new URL(e.posterSourceUrl).protocol,"https:");
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
 assert.match(marketplace,/Solo referencia · Sin venta/);
 assert.match(marketplace,/function openRealDetail/);
 assert.match(marketplace,/function openCheckout/);
 assert.match(marketplace,/no ha contratado|sin contrato/i);
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

test("todas las tarjetas se abren pulsando cualquier área y no contienen botones anidados",()=>{
 assert.match(marketplace,/class="card-hitbox"/);
 assert.match(marketplace,/data-real-detail/);
 assert.match(marketplace,/data-detail/);
 assert.match(marketplace,/class="poster-button"/);
 assert.doesNotMatch(marketplace,/<button class="poster-button"/);
 assert.match(marketplace,/class="card-heading"/);
});
test("los afiches visibles usan querySelectorAll y tienen fallback de error",async()=>{
 const style=await read("../src/commerce.css");
 assert.match(marketplace,/\$\$\("\.owner-poster, \.reference-poster"\)\.forEach/);
 assert.doesNotMatch(marketplace,/(?<!\$)\$\("\.owner-poster, \.reference-poster"\)\.forEach/);
 assert.match(marketplace,/img\.addEventListener\("error",failed\)/);
 assert.match(marketplace,/img\.dataset\.fallback/);
 assert.match(style,/\.real-poster \.reference-poster,\.demo-poster \.owner-poster\{opacity:1/);
 assert.match(style,/\.card-hitbox\{position:absolute;inset:0/);
});
test("portada ya no duplica destacados ni presenta bloques comerciales innecesarios",()=>{
 assert.doesNotMatch(portal,/id="featured-grid"/);
 assert.doesNotMatch(portal,/class="ticker"/);
 assert.doesNotMatch(portal,/class="purchase-steps/);
 assert.doesNotMatch(portal,/class="organizer-spotlight"/);
 assert.match(portal,/id="real-events-grid"/);
 assert.match(portal,/id="events-grid"/);
});

test("la selección de entradas requiere login de servidor, sin alias ni pedidos desde localStorage",()=>{
 assert.doesNotMatch(portal,/Alias ficticio/);
 assert.match(portal,/id="login-backdrop"/);
 assert.match(marketplace,/function showLogin|async function showLogin/);
 assert.match(marketplace,/refreshBuyer\(\)/);
 assert.match(marketplace,/buyerRequest\("orders"/);
 assert.doesNotMatch(marketplace,/simulateOrder\(/);
 assert.doesNotMatch(marketplace,/name="alias"/);
});

test("los afiches no llevan etiqueta flotante de fecha y conservan su fecha informativa",async()=>{
 const styles=await read("../src/portal.css");
 assert.doesNotMatch(marketplace,/class="card-date"/);
 assert.equal(styles.includes(".card-date{"),false);
 assert.match(marketplace,/class="event-meta"/);
 assert.ok(marketplace.includes("short(event.date)"));
 assert.match(marketplace,/data-real-detail/);
 assert.match(marketplace,/data-detail/);
});

test("cada evento tiene un identificador interno único y aparece solo en el control",async()=>{
 const all=[...demo.events,...refs.events];
 const ids=all.map(event=>event.id);
 assert.ok(ids.every(id=>typeof id==="string"&&id.length>0));
 assert.equal(new Set(ids).size,ids.length);
 const control=await read("../src/control.mjs");
 assert.match(control,/ID interno: <code>/);
 assert.ok(control.includes("esc(e.id)"));
 assert.doesNotMatch(marketplace,/ID interno:/);
});


test("el círculo verde con flecha desaparece en todas las tarjetas, sin perder interacción",async()=>{
 const portalCss=await read("../src/portal.css");
 const commerceCss=await read("../src/commerce.css");
 assert.doesNotMatch(marketplace,/poster-arrow/);
 assert.doesNotMatch(portalCss,/poster-arrow/);
 assert.doesNotMatch(commerceCss,/poster-arrow/);
 // Ambas tarjetas conservan la superposición accesible y clicable.
 assert.match(marketplace,/class="card-hitbox" type="button" data-real-detail=/);
 assert.match(marketplace,/class="card-hitbox" type="button" data-detail=/);
 assert.match(marketplace,/class="event-meta"/);
 assert.ok(marketplace.includes("short(event.date)"));
});


test("Centro de Control conserva atribución pero no publica enlaces externos en referencias",async()=>{
 const control=await read("../src/control.mjs");
 const references=control.slice(control.indexOf("function renderReferences()"),control.indexOf("function render(){"));
 assert.ok(references.includes("e.posterCredit"));
 assert.ok(references.includes("ID interno: <code>"));
 assert.doesNotMatch(references,/Fuente oficial del evento|Procedencia del afiche/);
 assert.doesNotMatch(references,/href=/);
 assert.doesNotMatch(references,/sourceUrl|posterSourceUrl/);
});

test("la portada solo muestra eventos reales y conserva DEMO fuera del catálogo visible",()=>{
 assert.ok(portal.includes('id="real-events-grid"'));
 assert.ok(portal.includes('id="events-grid" hidden aria-hidden="true"'));
 assert.doesNotMatch(portal,/Compra de demostración|EVENTOS FICTICIOS|Prueba la selección de entradas/);
 assert.match(portal,/Eventos reales/);
 assert.match(portal,/Cartelera de referencia/);
 assert.match(marketplace,/function allCatalogEvents\(\)\{return realEvents\(\);\}/);
 assert.match(marketplace,/const real=realEvents\(\)\.filter\(matches\)/);
 assert.match(marketplace,/\$\("#events-grid"\)\.replaceChildren\(\)/);
 assert.match(marketplace,/selectHeroEvents\(realSamples,\[\],current\(\),6\)/);
 assert.match(marketplace,/eventos reales de referencia/);
 assert.doesNotMatch(marketplace,/eventos de compra DEMO/);
 // Preserve internal purchase simulations and their test coverage, not public sales.
 assert.ok(demo.events.length>=8);
});


test("la portada muestra fichas completas y la compra DEMO sigue el mismo recorrido del comprador",async()=>{
 const {hasHeroPoster,hasEventDescription}=await import("../src/hero-carousel.mjs");
 const visuals=refs.events.filter(e=>hasHeroPoster(e,"reference")&&hasEventDescription(e));
 assert.equal(visuals.length,6);
 assert.ok(visuals.every(e=>e.description.trim().length>=40));
 assert.ok(visuals.every(e=>e.posterUrl.startsWith("https://")));
 assert.match(marketplace,/hasHeroPoster\(e,"reference"\)&&hasEventDescription\(e\)/);
 assert.ok(marketplace.includes('esc(event.description)'));
 assert.equal(portal.includes('id="lab-trigger"'),false);
 assert.equal(portal.includes('id="lab-testing"'),false);
 assert.equal(marketplace.includes("setupPurchaseLab()"),false);
 const page=await read("../evento.html");
 const eventJs=await read("../src/event-page.mjs");
 assert.ok(page.includes('id="reference-checkout"'));
 assert.ok(page.includes('id="reference-checkout-next"'));
 assert.ok(page.includes('id="reference-checkout-confirm"'));
 assert.ok(eventJs.includes('renderReferenceCheckout(event)'));
 assert.ok(eventJs.includes('referenceOrderReceipt(quote,crypto.randomUUID())'));
 assert.ok(eventJs.includes('changeDemoTier?.(target.dataset.zoneSelect)'));
 assert.ok(!portal.includes('Compra de demostración'));
 // The fixture remains intact for local authentication, inventory and purchase tests.
 assert.ok(demo.events.length>=8);
 assert.ok(demo.events.every(e=>e.ticketTypes.length>=1));
});
