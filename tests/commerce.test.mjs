import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seedCommerce, quote, available, simulateOrder, createOrganizerEvent, cancelSimulatedOrder, statsForOrganizer, organizerEvents, ordersForOrganizer, saveCommerce, loadCommerce } from "../src/commerce-domain.mjs";

const catalog = JSON.parse(await readFile(new URL("../data/eventos-clientes-demo.json",import.meta.url),"utf8"));
test("cargo de servicio y total se muestran sin ocultar comisiones", () => {
 const s=seedCommerce(catalog);
 const q=quote(s,"demo-noches-aurora","general",2);
 assert.equal(q.faceValueClp,30000);
 assert.equal(q.serviceFeeClp,4000);
 assert.equal(q.totalClp,34000);
 assert.equal(q.venueShareClp,600);
 assert.equal(q.platformShareClp,3400);
});
test("la compra DEMO consume cupos, bloquea exceso y puede anularse", () => {
 const s=seedCommerce(catalog);
 const before=available(s,"demo-noches-aurora","general");
 const order=simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:3,buyerId:"buyer-demo-001"});
 assert.equal(order.status,"demo_confirmed");
 assert.equal(available(s,"demo-noches-aurora","general"),before-3);
 assert.throws(()=>cancelSimulatedOrder(s,"org-escena",order.id),/otra organización/);
 cancelSimulatedOrder(s,"org-aurora",order.id);
 assert.equal(available(s,"demo-noches-aurora","general"),before);
 assert.throws(()=>cancelSimulatedOrder(s,"org-aurora",order.id),/ya anulada/);
});
test("dos organizadores no consultan ni publican eventos de otro",()=>{
 const s=seedCommerce(catalog);
 assert.equal(organizerEvents(s,"org-escena").some(e=>e.organizerId==="org-aurora"),false);
 assert.throws(()=>organizerEvents(s,"inexistente"),/desconocida/);
 const form={title:"Muestra pública ficticia",venue:"Teatro de prueba",city:"Concepción",date:"2027-06-12",time:"20:00",category:"Teatro",priceClp:12000,capacity:40,description:"Un evento de prueba con material propio"};
 const e=createOrganizerEvent(s,"org-escena",form);
 assert.equal(e.organizerId,"org-escena");
 assert.equal(organizerEvents(s,"org-aurora").some(x=>x.id===e.id),false);
 assert.throws(()=>createOrganizerEvent(s,"org-escena",{...form,posterUrl:"https://example.com/poster.webp"}),/autorización/);
 assert.throws(()=>createOrganizerEvent(s,"org-escena",{...form,capacity:-5}),/fuera de rango/);
});
test("no incluye cobro real, QR válido ni datos de pago",()=>{
 const s=seedCommerce(catalog);
 const o=simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,buyerId:"buyer-demo-001"});
 assert.match(o.id,/^SIM-/);
 assert.equal(o.status,"demo_confirmed");
 assert.equal(o.pricing.note.includes("sin procesamiento de pagos"),true);
 assert.equal("qr" in o,false);
 assert.equal(statsForOrganizer(s,"org-escena").orders,0);
 assert.equal(ordersForOrganizer(s,"org-aurora").length,1);
});
test("almacenamiento local persiste únicamente una demo por navegador",()=>{
 const db=new Map(),memory={getItem:key=>db.get(key)||null,setItem:(key,v)=>db.set(key,v),removeItem:key=>db.delete(key)};
 const state=seedCommerce(catalog);
 simulateOrder(state,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,buyerId:"buyer-demo-001"});
 assert.equal(saveCommerce(state,memory),true);
 assert.equal(loadCommerce(catalog,memory).orders.length,1);
});

test("reintento de compra DEMO con misma clave no duplica cupos",()=>{
 const s=seedCommerce(catalog);
 const input={eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:2,buyerId:"buyer-demo-001",idempotencyKey:"retry-demo-order-001"};
 const before=available(s,input.eventId,input.ticketTypeId);
 const first=simulateOrder(s,input);
 const second=simulateOrder(s,input);
 assert.equal(first.id,second.id);
 assert.equal(s.orders.length,1);
 assert.equal(available(s,input.eventId,input.ticketTypeId),before-2);
 assert.throws(()=>simulateOrder(s,{...input,quantity:3}),/idempotencia reutilizada/);
});
test("rechaza fechas imposibles al crear un evento",()=>{
 const s=seedCommerce(catalog);
 const input={title:"Evento ficticio",venue:"Teatro de prueba",city:"Concepción",date:"2027-02-30",time:"20:00",category:"Teatro",priceClp:1000,capacity:10};
 assert.throws(()=>createOrganizerEvent(s,"org-aurora",input),/Fecha inválida/);
});

test("no permite publicar eventos DEMO con fecha pasada",()=>{
 const s=seedCommerce(catalog);
 const input={title:"Evento pasado",venue:"Teatro de prueba",city:"Concepción",date:"2020-01-01",time:"20:00",category:"Teatro",priceClp:1000,capacity:10};
 assert.throws(()=>createOrganizerEvent(s,"org-aurora",input),/pasado/);
});

test("precio visible mantiene desglose al agotarse un evento, sin permitir órdenes nuevas",()=>{
 const s=seedCommerce(catalog);
 const event=s.events.find(e=>e.id==="demo-noches-aurora");
 event.ticketTypes.find(t=>t.id==="general").capacity=0;
 assert.throws(()=>quote(s,event.id,"general",1),/insuficientes/);
 const preview=quote(s,event.id,"general",1,{availabilityRequired:false});
 assert.equal(preview.unitBaseClp,15000);
 assert.equal(preview.feePerTicketClp,2000);
 assert.equal(preview.totalClp,17000);
 assert.throws(()=>simulateOrder(s,{eventId:event.id,ticketTypeId:"general",quantity:1,buyerId:"buyer-demo-001"}),/insuficientes/);
 assert.equal(s.orders.length,0);
});
