import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seedCommerce, simulateOrder, quote } from "../src/commerce-domain.mjs";
import { ownerOverview,ownerEvents,ownerOrders,ownerRegisterPartner,ownerPublishEvent,ownerSetEventState,ownerSetFeePolicy,ownerSetShare,ownerCancelDemo,ownerReferenceCatalog } from "../src/control-domain.mjs";
const fixtures=JSON.parse(await readFile(new URL("../data/eventos-clientes-demo.json",import.meta.url),"utf8"));
const refs=JSON.parse(await readFile(new URL("../data/eventos-reales-referencia.json",import.meta.url),"utf8"));
test("control central consolida todas las organizaciones sin ser panel de un organizador",()=>{
 const s=seedCommerce(fixtures);
 simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:2,alias:"Persona ficticia"});
 simulateOrder(s,{eventId:"demo-luces-del-sur",ticketTypeId:"vip",quantity:1,alias:"Comprador sintético"});
 const o=ownerOverview(s);
 assert.equal(o.organizers,3);
 assert.equal(o.orders,2);
 assert.equal(o.tickets,3);
 assert.equal(ownerOrders(s).length,2);
 assert.ok(ownerOrders(s).some(x=>x.organizerName.includes("Aurora")));
 assert.ok(ownerOrders(s).some(x=>x.organizerName.includes("Escena")));
 assert.ok(o.serviceFeeClp>0&&o.grossClp>o.faceValueClp);
});
test("solo control DEMO agrega productores y decide a cuál asignar eventos",()=>{
 const s=seedCommerce(fixtures);
 const p=ownerRegisterPartner(s,{name:"Productora Ficticia",shareBps:1000});
 const e=ownerPublishEvent(s,p.id,{title:"Prueba nueva",venue:"Recinto DEMO",city:"Valparaíso",date:"2027-11-11",time:"19:00",category:"Teatro",priceClp:15000,capacity:30,description:"Prueba de publicación administrada centralmente"});
 assert.equal(e.organizerId,p.id);
 assert.equal(ownerEvents(s).find(x=>x.id===e.id).organizerName,p.name);
 ownerSetEventState(s,e.id,"paused");
 assert.equal(s.events.find(x=>x.id===e.id).status,"paused");
 assert.throws(()=>quote(s,e.id,"general",1),/no está publicado/);
 ownerSetEventState(s,e.id,"published");
 assert.equal(quote(s,e.id,"general",1).totalClp,17000);
});
test("cargos y reparto B2B son configurables solo como simulación",()=>{
 const s=seedCommerce(fixtures);
 ownerSetFeePolicy(s,1500,750);
 ownerSetShare(s,"org-aurora",2500);
 const price=quote(s,"demo-noches-aurora","general",1);
 assert.equal(price.serviceFeeClp,3000);
 assert.equal(price.venueShareClp,750);
 assert.throws(()=>ownerSetFeePolicy(s,100000,0),/inválido/);
 assert.throws(()=>ownerSetShare(s,"org-aurora",20000),/inválido/);
});
test("control central puede anular operaciones ficticias sin modificar otras",()=>{
 const s=seedCommerce(fixtures);
 const a=simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,alias:"Comprador DEMO"});
 const b=simulateOrder(s,{eventId:"demo-luces-del-sur",ticketTypeId:"vip",quantity:1,alias:"Comprador DEMO"});
 ownerCancelDemo(s,a.id);
 assert.equal(ownerOverview(s).orders,1);
 assert.equal(ownerOrders(s).find(x=>x.id===b.id).status,"demo_confirmed");
});
test("espectáculos reales son referencias sin autorización ni precio PaseListo",()=>{
 const items=ownerReferenceCatalog(refs);
 assert.ok(items.length>=5);
 assert.ok(items.every(x=>x.saleEnabled===false&&x.authorization==="not_authorized"&&x.price===null));
 assert.ok(items.every(x=>x.posterUrl.startsWith("https://")&&x.sourceUrl.startsWith("https://")&&x.posterCredit));
});
