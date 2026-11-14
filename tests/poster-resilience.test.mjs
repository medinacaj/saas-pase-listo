import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {hasHeroPoster,hasEventDescription,selectHeroEvents} from "../src/hero-carousel.mjs";

const marketplace=await readFile(new URL("../src/marketplace.mjs",import.meta.url),"utf8");
const start=marketplace.indexOf("function installImages(){");
const end=marketplace.indexOf("\nfunction filters(){",start);
assert.ok(start>=0 && end>start,"poster installer missing");
const installer=marketplace.slice(start,end);

function simulatePoster({complete=true,naturalWidth=0,fallback=null}={}){
 const events=new Map(),css=new Set();
 const frame={classList:{add:value=>css.add(value)}};
 let imageRemoved=false,cardRemoved=false;
 const card={remove(){cardRemoved=true;}};
 const img={
  dataset:fallback?{fallback}:{},
  complete,naturalWidth,src:"https://example.test/official.jpg",
  closest(selector){
   if(selector===".poster-frame")return frame;
   if(selector===".event-card.reference-event")return card;
   return null;
  },
  addEventListener:(name,fn)=>events.set(name,fn),
  remove(){imageRemoved=true;}
 };
 const context={ $$:()=>[img] };
 vm.runInNewContext(installer+"\ninstallImages();",context);
 return {img,events,css,card,wasCardRemoved:()=>cardRemoved,wasImageRemoved:()=>imageRemoved};
}
test("no oculta tarjetas si una imagen lazy todavía no terminó de cargar",()=>{
 const p=simulatePoster({complete:true,naturalWidth:0});
 assert.ok(p.events.has("error"));
 assert.equal(p.wasImageRemoved(),false,"lazy image must not be prematurely removed");
 assert.equal(p.wasCardRemoved(),false);
 assert.equal(p.css.has("image-failed"),false);
});
test("un error final de imagen conserva la ficha y el número de eventos",()=>{
 const p=simulatePoster();
 p.events.get("error")();
 assert.equal(p.wasImageRemoved(),true);
 assert.equal(p.wasCardRemoved(),false,"the poster host is not the event catalog");
 assert.ok(p.css.has("image-failed"));
 assert.ok(!marketplace.includes("referenceCard.remove()"));
 assert.ok(!marketplace.includes("brokenReferenceImages"));
 assert.ok(!marketplace.includes("heroBrokenIds"));
});
test("fuente alternativa de afiche intenta recuperarse antes de mostrar fallback",()=>{
 const backup="https://example.test/backup.jpg";
 const p=simulatePoster({complete:false,fallback:backup});
 p.events.get("error")();
 assert.equal(p.img.src,backup);
 assert.equal(p.wasImageRemoved(),false);
 p.events.get("error")();
 assert.equal(p.wasImageRemoved(),true);
 assert.equal(p.wasCardRemoved(),false);
});
test("los seis ejemplos del catálogo mantienen imagen y descripción independientemente de fallos remotos",async()=>{
 const refs=JSON.parse(await readFile(new URL("../data/eventos-reales-referencia.json",import.meta.url),"utf8"));
 const examples=refs.events.filter(e=>(e.endDate||e.date)>="2026-11-11"&&hasHeroPoster(e,"reference")&&hasEventDescription(e));
 assert.equal(examples.length,10);
 assert.ok(examples.every(x=>x.posterUrl&&x.description.length>=40));
 assert.equal(selectHeroEvents(refs.events,[],"2026-11-11",6).length,6);
 assert.ok(marketplace.includes('const real=realEvents().filter(matches)'));
 assert.ok(marketplace.includes('real.map(realCard).join("")'));
});
