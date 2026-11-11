import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectHeroEvents, splitHeroTitle, hasHeroPoster } from "../src/hero-carousel.mjs";

const read=async path=>readFile(new URL(path,import.meta.url),"utf8");
const poster="https://example.test/valid-event-poster.jpg";

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
 const selected=selectHeroEvents([...week,...future],[],now);
 assert.deepEqual(selected.map(e=>e.id),["poster-1","camila","fauna"]);
 assert.ok(selected.every(e=>hasHeroPoster(e,e.kind)));
 assert.equal(selectHeroEvents(week,[],now,2).length,1);
 assert.equal(selectHeroEvents([{id:"old",title:"Old",date:"2026-11-01",posterUrl:poster}],[],now).length,0);
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

test("el catálogo real aporta seis diapositivas futuras con afiche, no ejemplos tipográficos",async()=>{
 const refs=await read("../data/eventos-reales-referencia.json").then(JSON.parse);
 const demos=await read("../data/eventos-clientes-demo.json").then(JSON.parse);
 const selected=selectHeroEvents(refs.events,demos.events,"2026-11-10",6);
 assert.equal(selected.length,6);
 assert.equal(selected[0].id,"ref-camila-2026");
 assert.ok(selected.every(e=>hasHeroPoster(e,e.kind)));
 assert.ok(selected.every(e=>e.posterUrl.startsWith("https://")));
 assert.ok(selected.every(e=>e.kind==="reference"));
 assert.ok(selected.every(e=>e.date>="2026-11-10"));
});

test("portada conserva navegación visual y descarta afiches fallidos",async()=>{
 const [index,marketplace,style]=await Promise.all([
  read("../index.html"),read("../src/marketplace.mjs"),read("../src/hero-carousel.css")
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
 assert.ok(marketplace.includes('heroBrokenIds.add(event.id)'));
 assert.ok(marketplace.includes('heroImage.addEventListener("error",skipBrokenImage)'));
 assert.ok(marketplace.includes('hasHeroPoster(e,"reference")'));
 assert.ok(marketplace.includes('installImages()'));
 assert.ok(style.includes(".hero-carousel .hero-inner"));
 assert.ok(style.includes(".hero-carousel-dot.is-active"));
 assert.ok(!index.includes('id="week-strip"'));
 assert.ok(index.includes('id="real-events-grid"'));
 assert.ok(index.includes('id="events-grid"'));
});
