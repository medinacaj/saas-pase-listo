import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectHeroEvents, splitHeroTitle } from "../src/hero-carousel.mjs";

const read=async path=>readFile(new URL(path,import.meta.url),"utf8");

test("destaca cuatro eventos vigentes y dos próximos sin usar la barra semanal",()=>{
 const now="2026-11-10";
 const week=[
  {id:"cream",title:"Creamfields",date:"2026-11-14",heroPriority:99},
  {id:"cypress",title:"Cypress Hill",date:"2026-11-11",heroPriority:91},
  {id:"feria",title:"Feria Sanguche",date:"2026-11-13",heroPriority:85},
  {id:"conce",title:"León Gieco",date:"2026-11-15",heroPriority:81},
  {id:"other",title:"Otro",date:"2026-11-12",heroPriority:1},
  {id:"past",title:"Pasado",date:"2026-11-09",heroPriority:1000}
 ];
 const future=[
  {id:"camila",title:"Camila",date:"2026-11-20",featured:true,heroPriority:93,posterUrl:"https://example.test/poster.jpg"},
  {id:"fauna",title:"Fauna Primavera",date:"2026-11-26",featured:true,heroPriority:90,posterUrl:"https://example.test/poster.jpg"}
 ];
 const selected=selectHeroEvents([...future,...week],[],now);
 assert.deepEqual(selected.map(e=>e.id),["cream","cypress","feria","conce","camila","fauna"]);
 assert.ok(selected.every(e=>e.kind==="reference"));
 assert.equal(selectHeroEvents(week,[],now,2).length,2);
 assert.equal(selectHeroEvents([{id:"old",title:"Old",date:"2026-11-01"}],[],now).length,0);
});

test("excluye borradores y eventos pasados y usa solo identificadores únicos",()=>{
 const refs=[{id:"dup",title:"Uno",date:"2026-11-11"}];
 const demos=[
  {id:"dup",title:"Copia",date:"2026-11-12",status:"published"},
  {id:"draft",title:"Draft",date:"2026-11-12",status:"draft"},
  {id:"good",title:"Demo",date:"2026-11-13",status:"published"}
 ];
 const items=selectHeroEvents(refs,demos,"2026-11-10");
 assert.deepEqual(items.map(x=>x.id),["dup","good"]);
 assert.equal(items[1].kind,"demo");
});

test("separa titulares en dos líneas sin crear nombres nuevos",()=>{
 assert.deepEqual(splitHeroTitle("Creamfields Chile"),{main:"Creamfields",accent:"Chile."});
 assert.deepEqual(splitHeroTitle("Feria del Sanguche"),{main:"Feria del",accent:"Sanguche."});
 assert.deepEqual(splitHeroTitle("Camila","Tour Adiós"),{main:"Camila",accent:"Tour Adiós"});
 assert.deepEqual(splitHeroTitle(""),{main:"Eventos",accent:"en Chile."});
});

test("el carrusel principal tiene navegación, rotación, pausa y enlaces individuales",async()=>{
 const [index,marketplace,style,refs]=await Promise.all([
  read("../index.html"),read("../src/marketplace.mjs"),
  read("../src/hero-carousel.css"),read("../data/eventos-reales-referencia.json").then(JSON.parse)
 ]);
 for(const selector of ["hero-feature-title","hero-feature-link","hero-slide-count","hero-carousel-dots","hero-poster","hero-carousel-controls"]){
  assert.ok(index.includes('id="'+selector+'"'),selector);
 }
 assert.ok(index.includes('data-hero-step="-1"'));
 assert.ok(index.includes('data-hero-step="1"'));
 assert.ok(index.includes("data-hero-toggle"));
 assert.ok(marketplace.includes('window.setInterval('));
 assert.ok(marketplace.includes("6500"));
 assert.ok(marketplace.includes("prefers-reduced-motion"));
 assert.ok(marketplace.includes("mouseenter"));
 assert.ok(marketplace.includes("visibilitychange"));
 assert.ok(marketplace.includes("eventDetailHref(event.id)"));
 assert.ok(marketplace.includes('realPoster(event,true)'));
 assert.ok(marketplace.includes('installImages()'));
 assert.ok(style.includes(".hero-carousel .hero-inner"));
 assert.ok(style.includes(".hero-carousel-dot.is-active"));
 assert.ok(!index.includes('id="week-strip"'));
 assert.ok(index.includes('id="real-events-grid"'));
 assert.ok(index.includes('id="events-grid"'));
 assert.ok(refs.events.some(e=>e.heroPriority>=95));
 const selected=selectHeroEvents(refs.events,[],"2026-11-10");
 assert.equal(selected[0].id,"ref-creamfields-2026");
 assert.ok(selected.some(e=>e.posterUrl));
});
