import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
 eventDetailHref, daysUntilEvent, forecastAvailable, weatherDescription
} from "../src/event-page-domain.mjs";

const read=async path=>readFile(new URL(path,import.meta.url),"utf8");

test("cada evento tiene enlace propio y codificación segura del ID",()=>{
 assert.equal(eventDetailHref("ref-camila-2026"),"./evento.html?id=ref-camila-2026");
 assert.equal(eventDetailHref("demo-noches-aurora"),"./evento.html?id=demo-noches-aurora");
 assert.equal(eventDetailHref("evento & prueba"),"./evento.html?id=evento%20%26%20prueba");
 assert.throws(()=>eventDetailHref(""),/inválido/);
 assert.throws(()=>eventDetailHref("x".repeat(161)),/inválido/);
});

test("pronóstico solo dentro de los próximos catorce días",()=>{
 assert.equal(daysUntilEvent("2026-11-20","2026-11-10"),10);
 assert.equal(forecastAvailable("2026-11-10","2026-11-10"),true);
 assert.equal(forecastAvailable("2026-11-23","2026-11-10"),true);
 assert.equal(forecastAvailable("2026-11-24","2026-11-10"),false);
 assert.equal(forecastAvailable("2027-04-24","2026-11-10"),false);
 assert.equal(forecastAvailable("2026-11-09","2026-11-10"),false);
 assert.equal(weatherDescription(0),"Despejado");
 assert.equal(weatherDescription(63),"Lluvia");
 assert.equal(weatherDescription(95),"Tormentas");
});

test("las tarjetas abren fichas individuales y no muestran el enlace oficial eliminado",async()=>{
 const marketplace=await read("../src/marketplace.mjs");
 assert.ok(marketplace.includes('location.assign(eventDetailHref(real.dataset.realDetail))'));
 assert.ok(marketplace.includes('location.assign(eventDetailHref(d.dataset.detail))'));
 assert.ok(marketplace.includes('openCheckout(checkoutEvent,checkoutType)'));
 assert.equal(marketplace.includes("Ver fuente oficial de la fecha y recinto"),false);
 assert.ok(marketplace.includes("data-real-detail"));
 assert.ok(marketplace.includes("data-detail"));
});

test("ficha individual contiene recinto, precios por categoría, estado y clima discreto",async()=>{
 const html=await read("../evento.html");
 const css=await read("../src/event-page.css");
 const code=await read("../src/event-page.mjs");
 assert.ok(html.includes('id="event-page-view"'));
 assert.ok(html.includes('id="venue-description"'));
 assert.ok(html.includes('id="event-ticket-list"'));
 assert.ok(html.includes('id="event-weather"'));
 assert.ok(css.includes(".event-page-tickets"));
 assert.ok(css.includes(".event-weather-content"));
 assert.ok(code.includes("forecastAvailable(event.date,today,14)"));
 assert.ok(code.includes("geocoding-api.open-meteo.com"));
 assert.ok(code.includes("api.open-meteo.com/v1/forecast"));
 assert.ok(code.includes("precipitation_probability_max"));
 assert.ok(code.includes("SIMULADOR: sectores, precios, cupos y cargos son ficticios"));
 assert.ok(code.includes("event.posterRights"));
 assert.ok(code.includes('const real=refs.events?.find(e=>e.id===id)'));
 assert.equal(html.includes("Ver fuente oficial de la fecha y recinto"),false);
 assert.equal(code.includes("Ver fuente oficial de la fecha y recinto"),false);
});

test("servidor DEMO permite cargar la ficha y sus recursos estáticos",async()=>{
 const server=await read("../server/buyer-server.mjs");
 assert.ok(server.includes('["/evento.html", ["evento.html", "text/html"]]'));
 for(const asset of ["src/event-page.mjs","src/event-page-domain.mjs","src/event-page.css"]){
  assert.ok(server.includes('["/'+asset+'", ["'+asset+'",'));
 }
});


test("recinto permite datos prácticos sin inventar los no confirmados",async()=>{
 const html=await read("../evento.html");
 const code=await read("../src/event-page.mjs");
 const css=await read("../src/event-page.css");
 for(const id of ["venue-address","venue-doors","venue-accessibility","venue-transport","venue-age","venue-entry"]){
  assert.ok(html.includes('id="'+id+'"'));
  assert.ok(code.includes('setText("#'+id+'"'));
 }
 assert.ok(code.includes('fallback="Por confirmar"'));
 assert.ok(css.includes(".venue-details-grid"));
});


test("clasificación DEMO recibe colores estables, zonas únicas y orden de precio",async()=>{
 const { buildVenueZones, ZONE_COLORS, zoneBandPath, zoneBandLabelY }=
  await import("../src/venue-zones.mjs");
 const tickets=[{id:"general",name:"General",priceClp:15000},
  {id:"premium",name:"Experiencia",priceClp:28000}];
 const zones=buildVenueZones(tickets);
 assert.deepEqual(zones.map(z=>z.id),["premium","general"]);
 assert.equal(zones[0].color,ZONE_COLORS[0]);
 assert.notEqual(zones[0].color,zones[1].color);
 assert.equal(zones[0].name,"Experiencia");
 assert.equal(zones[1].name,"General");
 assert.match(zoneBandPath(0,2),/^M /);
 assert.notEqual(zoneBandPath(0,2),zoneBandPath(1,2));
 assert.ok(zoneBandLabelY(0,2)<zoneBandLabelY(1,2));
 assert.throws(()=>zoneBandPath(-1,2),/inválida/);
 assert.throws(()=>zoneBandPath(0,0),/inválida/);
 assert.deepEqual(buildVenueZones([]),[]);
 assert.deepEqual(buildVenueZones(null),[]);
 const colorSafety=new Set(ZONE_COLORS);
 assert.equal(colorSafety.size,ZONE_COLORS.length);
 assert.ok(ZONE_COLORS.every(color=>/^#[0-9a-f]{6}$/i.test(color)));
});

test("plano de zonas y leyenda interactiva conectan con desglose de entradas",async()=>{
 const html=await read("../evento.html");
 const js=await read("../src/event-page.mjs");
 const css=await read("../src/event-page.css");
 const localServer=await read("../server/buyer-server.mjs");
 for(const id of ["venue-map-heading","venue-zone-map","venue-zone-legend","venue-zone-selection","venue-map-accuracy"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(js.includes('buildVenueZones(event.ticketTypes)'));
 assert.ok(js.includes('zoneBandPath(index,zones.length)'));
 assert.ok(js.includes('ticketSummary(event,type,store,inventory)'));
 assert.ok(js.includes('data-zone-select'));
 assert.ok(js.includes('data-ticket-zone'));
 assert.ok(js.includes('renderVenueMap(event,store,reference,inventory)'));
 assert.ok(js.includes('setAttribute("aria-pressed",String(active))'));
 assert.ok(js.includes('if(reference){'));
 assert.ok(js.includes('PLANO 100 % FICTICIO'));
 assert.ok(js.includes('changeDemoTier?.(target.dataset.zoneSelect)'));
 assert.ok(js.includes('Plano ilustrativo DEMO'));
 assert.ok(css.includes(".venue-map-zone.is-selected"));
 assert.ok(css.includes(".venue-zone-key.is-selected"));
 assert.ok(css.includes(".event-ticket-row.is-zone-selected"));
 assert.ok(localServer.includes('["/src/venue-zones.mjs", ["src/venue-zones.mjs", "text/javascript"]]'));
});

test("la ficha de referencia permite probar entradas, resumen y confirmación sin cobros",async()=>{
 const [html,code,css,server]=await Promise.all([
  read("../evento.html"),read("../src/event-page.mjs"),read("../src/event-page.css"),
  read("../server/buyer-server.mjs")
 ]);
 for(const id of ["reference-checkout","reference-ticket-quantity","reference-checkout-next",
  "reference-checkout-review","reference-checkout-summary","reference-checkout-confirm",
  "reference-checkout-complete"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(code.includes("renderReferenceCheckout(event)"));
 assert.ok(code.includes("referenceQuote(event,selectedId,quantity.value)"));
 assert.ok(code.includes("referenceOrderReceipt(quote,crypto.randomUUID())"));
 assert.ok(code.includes("No se cobró dinero, no se hizo reserva"));
 assert.ok(code.includes('event.description||"Evento ficticio de demostración."'));
 assert.ok(css.includes(".reference-checkout-action"));
 assert.ok(server.includes('["/src/reference-checkout.mjs", ["src/reference-checkout.mjs", "text/javascript"]]'));
 assert.ok(html.includes("No se realizan pagos, reservas ni se emiten entradas válidas."));
});
