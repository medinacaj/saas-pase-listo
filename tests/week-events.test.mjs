import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chileToday, weekBounds, weeklyEventSelection } from "../src/week-events.mjs";

const read=async name=>readFile(new URL(name,import.meta.url),"utf8");

test("semana vigente de Chile va de lunes a domingo, incluso entre meses y años",()=>{
 assert.deepEqual(weekBounds("2026-11-10"),{start:"2026-11-09",end:"2026-11-15"});
 assert.deepEqual(weekBounds("2026-11-15"),{start:"2026-11-09",end:"2026-11-15"});
 assert.deepEqual(weekBounds("2027-01-01"),{start:"2026-12-28",end:"2027-01-03"});
 assert.throws(()=>weekBounds("2026-11-31"),/inválida/);
 assert.equal(chileToday(new Date("2026-11-10T15:00:00Z")),"2026-11-10");
});

test("prioriza eventos reales y DEMO de la semana, con enlaces por ID único",()=>{
 const refs=[{id:"real-1",title:"Concierto",city:"Santiago",date:"2026-11-10"},
  {id:"real-2",title:"Feria",city:"Concepción",date:"2026-11-17"}];
 const demos=[{id:"demo-1",title:"Teatro",city:"Valparaíso",date:"2026-11-15",status:"published"},
  {id:"draft",title:"Borrador",date:"2026-11-12",status:"draft"},
  {id:"expired",title:"Terminado",date:"2026-11-08",status:"published"}];
 const selected=weeklyEventSelection(refs,demos,"2026-11-10");
 assert.deepEqual(selected.week.map(e=>e.id),["real-1","demo-1"]);
 assert.equal(selected.weekCount,2);
 assert.deepEqual(selected.upcoming.map(e=>e.id),["real-2"]);
 assert.equal(selected.week[0].kind,"reference");
 assert.equal(selected.week[1].kind,"demo");
 const past=weeklyEventSelection([{id:"past",title:"Ayer",date:"2026-11-09"}],[],"2026-11-10");
 assert.equal(past.weekCount,0);
});

test("un evento de varios días figura mientras transcurre la semana",()=>{
 const selected=weeklyEventSelection([
  {id:"long",title:"Festival",date:"2026-11-07",endDate:"2026-11-14",city:"Santiago"}
 ],[],"2026-11-10");
 assert.equal(selected.weekCount,1);
 assert.equal(selected.week[0].id,"long");
 const ended=weeklyEventSelection([
  {id:"done",title:"Terminó",date:"2026-11-04",endDate:"2026-11-08"}
 ],[],"2026-11-10");
 assert.equal(ended.weekCount,0);
});

test("la semana real del 9 al 15 de noviembre tiene eventos contrastados",async()=>{
 const [demo,refs]=await Promise.all([
  read("../data/eventos-clientes-demo.json").then(JSON.parse),
  read("../data/eventos-reales-referencia.json").then(JSON.parse)
 ]);
 const selection=weeklyEventSelection(refs.events,demo.events,"2026-11-10",24);
 assert.ok(selection.weekCount>=15);
 assert.equal(selection.week.length,selection.weekCount);
 assert.equal(selection.week[0].id,"ref-ronnie-wood-2026-11-10");
 assert.ok(selection.week.some(e=>e.title==="Creamfields Chile"));
 assert.ok(selection.week.some(e=>e.title==="León Gieco"&&e.city==="Concepción"));
 assert.ok(selection.week.every(e=>e.date<="2026-11-15"&&e.endDate>="2026-11-10"));
 assert.equal(selection.upcoming[0].id,"ref-camila-2026");
 assert.ok(selection.upcoming.every(e=>e.date>"2026-11-15"));
 const sources=refs.events.filter(e=>e.date>="2026-11-10"&&e.date<="2026-11-15");
 assert.ok(sources.every(e=>e.sourceUrl.startsWith("https://")&&e.verifiedOn==="2026-11-10"));
 assert.ok(sources.every(e=>!e.ticketTypes&&!e.priceClp&&!e.posterUrl));
});

test("el carrusel reemplaza la franja semanal sin quitar las tarjetas de cartelera",async()=>{
 const [index,page,market,details,css,server]=await Promise.all([
  read("../index.html"),read("../evento.html"),read("../src/marketplace.mjs"),
  read("../src/event-page.mjs"),read("../src/hero-carousel.css"),
  read("../server/buyer-server.mjs")
 ]);
 assert.ok(index.includes('class="hero hero-carousel"'));
 assert.ok(index.includes('id="hero-carousel-controls"'));
 assert.ok(index.includes('id="hero-carousel-dots"'));
 assert.ok(index.includes('id="hero-poster"'));
 assert.ok(index.includes('id="real-events-grid"'));
 assert.ok(index.includes('id="events-grid"'));
 assert.ok(!index.includes('id="week-strip"'));
 assert.ok(!page.includes('id="week-strip"'));
 assert.ok(!details.includes('renderWeekStrip('));
 assert.ok(market.includes("renderFeatured()"));
 assert.ok(market.includes("chooseHero("));
 assert.ok(css.includes(".hero-carousel-controls"));
 assert.ok(server.includes('["/src/hero-carousel.mjs", ["src/hero-carousel.mjs", "text/javascript"]]'));
 assert.ok(server.includes('["/src/hero-carousel.css", ["src/hero-carousel.css", "text/css"]]'));
});
