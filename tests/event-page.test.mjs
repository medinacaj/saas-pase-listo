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
 assert.ok(code.includes("Precios no disponibles en PaseListo"));
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
