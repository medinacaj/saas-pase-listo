import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectHeroEvents, splitHeroTitle, hasHeroPoster, hasEventDescription } from "../src/hero-carousel.mjs";

const read=async path=>readFile(new URL(path,import.meta.url),"utf8");
const poster="https://example.test/valid-event-poster.jpg";
const described=items=>items.map(e=>({...e,description:e.description??"Ficha de concierto de prueba con información relevante, recinto y fecha del evento."}));

test("opción A: solo eventos con afiche pueden entrar al carrusel",()=>{
 const now="2026-11-10";
 const week=[
  {id:"cream",title:"Creamfields",date:"2026-11-14",heroPriority:99},
  {id:"cypress",title:"Cypress Hill",date:"2026-11-11",heroPriority:91},
  {id:"poster-1",title:"Con afiche",date:"2026-11-13",posterUrl:poster,heroPriority:85},
  {id:"missing",title:"No visual",date:"2026-11-15",posterUrl:"",heroPriority:100},
  {id:"past",title:"Pasado",date:"2026-11-09",posterUrl:poster,heroPriority:1000}
 ];
 const future=[
  {id:"camila",title:"Camila",date:"2026-11-20",featured:true,heroPriority:93,posterUrl:poster},
  {id:"fauna",title:"Fauna Primavera",date:"2026-11-26",featured:true,heroPriority:90,posterUrl:poster}
 ];
 const selected=selectHeroEvents(described([...week,...future]),[],now);
 assert.deepEqual(selected.map(e=>e.id),["poster-1","camila","fauna"]);
 assert.ok(selected.every(e=>hasHeroPoster(e,e.kind)&&hasEventDescription(e)));
 assert.equal(selectHeroEvents(described(week),[],now,2).length,1);
 assert.equal(selectHeroEvents(described([{id:"old",title:"Old",date:"2026-11-01",posterUrl:poster}]),[],now).length,0);
});

test("filtro de imágenes exige HTTPS y respeta derechos declarados de DEMO",()=>{
 assert.equal(hasHeroPoster({posterUrl:poster},"reference"),true);
 assert.equal(hasHeroPoster({posterUrl:"https://example.test/poster.png"},"reference"),true);
 for(const source of [null,"","javascript:alert(1)","http://example.test/img.jpg","/relative.jpg",
  "https://alice:password@example.test/private.jpg"]){
  assert.equal(hasHeroPoster({posterUrl:source},"reference"),false);
 }
 assert.equal(hasHeroPoster({posterUrl:poster},"demo"),false);
 assert.equal(hasHeroPoster({posterUrl:poster,posterRights:"demo"},"demo"),false);
 assert.equal(hasHeroPoster({posterUrl:poster,posterRights:"declarados_por_usuario_sin_verificar"},"demo"),true);
});

test("deduplica ID y excluye eventos DEMO sin afiche o no publicados",()=>{
 const refs=[{id:"dup",title:"Uno",date:"2026-11-11",posterUrl:poster}];
 const demos=[
  {id:"dup",title:"Copia",date:"2026-11-12",posterUrl:poster,posterRights:"declarados_por_usuario_sin_verificar",status:"published"},
  {id:"draft",title:"Borrador",date:"2026-11-12",posterUrl:poster,posterRights:"declarados_por_usuario_sin_verificar",status:"draft"},
  {id:"no-image",title:"No visual",date:"2026-11-12",status:"published"},
  {id:"good",title:"Con imagen",date:"2026-11-13",posterUrl:poster,posterRights:"declarados_por_usuario_sin_verificar",status:"published"}
 ];
 const items=selectHeroEvents(described(refs),described(demos),"2026-11-10");
 assert.deepEqual(items.map(x=>x.id),["dup","good"]);
 assert.equal(items[1].kind,"demo");
});

test("separa titulares en dos líneas sin crear nombres nuevos",()=>{
 assert.deepEqual(splitHeroTitle("Creamfields Chile"),{main:"Creamfields",accent:"Chile."});
 assert.deepEqual(splitHeroTitle("Feria del Sanguche"),{main:"Feria del",accent:"Sanguche."});
 assert.deepEqual(splitHeroTitle("Camila","Tour Adiós"),{main:"Camila",accent:"Tour Adiós"});
 assert.deepEqual(splitHeroTitle(""),{main:"Eventos",accent:"en Chile."});
});

test("el catálogo real aporta seis diapositivas futuras con afiche, no ejemplos tipográficos",async()=>{
 const refs=await read("../data/eventos-reales-referencia.json").then(JSON.parse);
 const demos=await read("../data/eventos-clientes-demo.json").then(JSON.parse);
 const selected=selectHeroEvents(refs.events,demos.events,"2026-11-10",6);
 assert.equal(selected.length,6);
 assert.equal(selected[0].id,"ref-creamfields-2026");
 assert.ok(selected.every(e=>hasHeroPoster(e,e.kind)));
 assert.ok(selected.every(e=>e.posterUrl.startsWith("https://")));
 assert.ok(selected.every(e=>e.kind==="reference"));
 assert.ok(selected.every(e=>e.date>="2026-11-10"));
});

test("portada conserva navegación visual y descarta afiches fallidos",async()=>{
 const [index,marketplace,style]=await Promise.all([
  read("../index.html"),read("../src/marketplace.mjs"),read("../src/hero-carousel.css")
 ]);
 for(const selector of ["hero-feature-title","hero-feature-link","hero-carousel-dots","hero-poster","hero-carousel-controls"]){
  assert.ok(index.includes('id="'+selector+'"'),selector);
 }
 assert.equal(index.includes('id="hero-slide-count"'),false);
 assert.equal(index.includes("data-hero-step"),false);
 assert.equal(index.includes("data-hero-toggle"),false);
 assert.ok(index.includes('id="hero-carousel-dots"'));
 assert.ok(marketplace.includes('window.setInterval('));
 assert.ok(marketplace.includes("6500"));
 assert.ok(marketplace.includes("prefers-reduced-motion"));
 assert.ok(marketplace.includes("mouseenter"));
 assert.ok(marketplace.includes("visibilitychange"));
 assert.ok(marketplace.includes("eventDetailHref(event.id)"));
 assert.ok(marketplace.includes('realPoster(event,true)'));
 assert.ok(!marketplace.includes("heroBrokenIds"));
 assert.ok(!marketplace.includes("brokenReferenceImages"));
 assert.ok(!marketplace.includes("skipBrokenImage"));
 assert.ok(!marketplace.includes("referenceCard.remove()"));
 assert.ok(marketplace.includes('hasHeroPoster(e,"reference")'));
 assert.ok(marketplace.includes('installImages()'));
 assert.ok(style.includes(".hero-carousel .hero-inner"));
 assert.ok(style.includes(".hero-carousel-dot.is-active"));
 assert.ok(style.includes("object-fit:cover"));
 assert.ok(style.includes("position:absolute;inset:0"));
 assert.ok(style.includes("height:clamp(310px,44svh,345px)"));
 assert.ok(style.includes(".hero-carousel .hero-poster-bottom{display:none}"));
 assert.ok(!style.includes("rotate(5deg)"));
 assert.ok(marketplace.includes('"touchstart"'));
 assert.ok(marketplace.includes('"touchend"'));
 assert.ok(marketplace.includes('"touchcancel"'));
 assert.ok(marketplace.includes('"pointerdown"'));
 assert.ok(marketplace.includes('"pointerup"'));
 assert.ok(marketplace.includes("advanceByGesture"));
 assert.ok(marketplace.includes("Math.abs(dy)*1.3"));
 assert.ok(marketplace.includes("stopImmediatePropagation"));
 assert.ok(marketplace.includes('ev.key==="ArrowRight"'));
 assert.equal(marketplace.includes("#hero-slide-count"),false);
 assert.equal(marketplace.includes("[data-hero-toggle]"),false);
 assert.equal(marketplace.includes("data-hero-step"),false);
 assert.ok(!index.includes('id="week-strip"'));
 assert.ok(index.includes('id="real-events-grid"'));
 assert.ok(index.includes('id="events-grid"'));
});

test("la portada rechaza afiches sin una descripción editorial completa",()=>{
 assert.equal(hasEventDescription({description:""}),false);
 assert.equal(hasEventDescription({subtitle:"Gira internacional"}),false);
 assert.equal(hasEventDescription({description:"Ficha sin detalles"}),false);
 assert.equal(hasEventDescription({description:"Concierto anunciado en Santiago con fecha, nombre de gira y ubicación del recinto."}),true);
 const missing=[{id:"incompleto",title:"No publicar",date:"2026-11-20",posterUrl:poster}];
 assert.deepEqual(selectHeroEvents(missing,[],"2026-11-11"),[]);
});
