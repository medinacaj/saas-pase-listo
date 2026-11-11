import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname,relative} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const catalog=JSON.parse(read("data/eventos-reales-referencia.json"));
const valid=catalog.events.filter(e=>e.posterUrl?.startsWith("https://")&&e.description?.trim().length>=40&&e.illustrationUrl);
const current="2026-11-11";
const upcoming=valid.filter(e=>(e.endDate||e.date)>=current);
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
test("ten real events are pre-rendered before JavaScript downloads",()=>{
 assert.equal(upcoming.length,10);
 const cards=[...html.matchAll(/<article class="event-card reference-event" data-static-reference="([^"]+)">/g)].map(x=>x[1]);
 assert.equal(cards.length,10);
 assert.equal(new Set(cards).size,cards.length);
 assert.deepEqual(new Set(cards),new Set(upcoming.map(e=>e.id)));
 assert.ok(html.includes('id="real-events-grid" class="events-grid" data-static-fallback="true"'));
 for(const event of upcoming){
  const filename=event.illustrationUrl.split("/").at(-1);
  assert.ok(existsSync(resolve(root,"assets/event-art",filename)),event.id+" image missing");
  assert.ok(html.includes('./assets/event-art/'+filename),'Static card does not render a local image: '+event.id);
  assert.ok(html.includes('evento.html?id='+event.id),'Static card not linked to event checkout');
  assert.ok(html.includes(event.title),'Event title missing from static fallback');
 }
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
