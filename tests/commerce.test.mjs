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
 const order=simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:3,alias:"Cliente de prueba"});
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
 const o=simulateOrder(s,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,alias:"Invitado de prueba"});
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
 simulateOrder(state,{eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,alias:"Invitado de prueba"});
 assert.equal(saveCommerce(state,memory),true);
 assert.equal(loadCommerce(catalog,memory).orders.length,1);
});
