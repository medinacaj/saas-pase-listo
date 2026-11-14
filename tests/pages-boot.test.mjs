import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname,relative} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const catalog=JSON.parse(read("data/eventos-reales-referencia.json"));
const html=read("index.html");

test("marketplace and event detail resolve every browser import on public branch",()=>{
 const starts=["src/marketplace.mjs","src/event-page.mjs"];
 const visited=new Set();
 function scan(path){
  const absolute=resolve(root,path);
  assert.ok(existsSync(absolute),"Missing required browser module: "+path);
  if(visited.has(path))return;
  visited.add(path);
  const source=read(path);
  const expressions=[...source.matchAll(/(?:^|\n)import\s+(?:[^\n]*?\s+from\s+)?["'](\.[^"']+)["']/g)];
  for(const match of expressions){
   const dep=relative(root,resolve(dirname(absolute),match[1])).replaceAll("\\","/");
   assert.ok(!dep.startsWith(".."),"Import outside public root");
   scan(dep);
  }
 }
 for(const path of starts)scan(path);
 assert.ok(visited.has("src/checkout-state.mjs"),"Buyer bootstrap requires checkout-state");
 assert.ok(visited.has("src/reference-checkout.mjs"),"Event detail requires purchase simulation");
 assert.ok(visited.has("src/hero-carousel.mjs"));
});
test("la portada sin JavaScript tampoco precarga eventos retirados",()=>{
 assert.equal(catalog.events.length,0);
 const cards=[...html.matchAll(/<article class="event-card reference-event" data-static-reference="([^"]+)">/g)].map(x=>x[1]);
 assert.equal(cards.length,0);
 assert.doesNotMatch(html,/evento\.html\?id=ref-/);
 assert.ok(html.includes('id="real-events-grid" class="events-grid" data-static-fallback="true"'));
});
test("PaseListo has custom brand favicon and cache-busted browser entrypoint",()=>{
 const favicon=read("favicon.svg");
 assert.ok(favicon.startsWith('<svg'));
 assert.ok(favicon.includes('viewBox="0 0 64 64"'));
 assert.ok(favicon.includes("#171c1b")&&favicon.includes("#e8ffad"));
 assert.ok(html.includes('rel="icon" href="./favicon.svg?v=20261111-ticket-mark"'));
 assert.ok(html.includes('marketplace.mjs?v='));
});
test("public visual gallery keeps a single explicit no-payment buyer journey",()=>{
 const details=read("evento.html");
 assert.ok(details.includes('id="reference-checkout"'));
 assert.ok(details.includes('id="reference-checkout-review"'));
 assert.ok(details.includes('id="reference-checkout-complete"'));
 assert.ok(!html.includes('id="lab-testing"'));
 assert.ok(html.includes('id="real-events-grid"'));
 assert.ok(read("src/reference-checkout.mjs").includes("ticketIssued:false"));
});

test("un catálogo vacío no crea destacados ficticios",async()=>{
 const {selectHeroEvents}=await import("../src/hero-carousel.mjs");
 assert.deepEqual(selectHeroEvents(catalog.events,[],"2026-11-14",6),[]);
 assert.doesNotMatch(html,/Creamfields|Feria del Sanguche|Los Tres/);
});
