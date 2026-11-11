import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {seedCommerce,createOrganizerEvent,simulateOrder,eventTicketLimit} from "../src/commerce-domain.mjs";
import {MASSIVE_EVENT_CAPACITY,WAITLIST_ADMISSION_SLOTS,WAITLIST_ADMISSION_TTL_MS,
 validateWaitingRoomSetting,eventRequiresWaitingRoom,waitingRoomStatus,joinWaitingRoom,
 leaveWaitingRoom,reconcileWaitingRoom} from "../src/waiting-room.mjs";
const fixture=JSON.parse(await readFile(new URL("../data/eventos-clientes-demo.json",import.meta.url),"utf8"));
const mass="demo-festival-masivo-2027";
const buyer=n=>"buyer-demo-waiting-"+String(n).padStart(5,"0");
test("límite predeterminado siete y lista obligatoria desde cinco mil cupos",()=>{
 const store=seedCommerce(fixture);
 assert.equal(eventTicketLimit(store.events[0]),7);
 assert.equal(MASSIVE_EVENT_CAPACITY,5000);
 assert.equal(validateWaitingRoomSetting(4999,false),false);
 assert.equal(validateWaitingRoomSetting(4999,true),true);
 assert.equal(validateWaitingRoomSetting(5000,false),true);
 assert.throws(()=>validateWaitingRoomSetting(6000,"false"),/inválida/);
 assert.throws(()=>validateWaitingRoomSetting(-20,true),/inválido/);
 const base={title:"Evento masivo de prueba",venue:"Recinto ficticio",city:"Santiago",
  date:"2027-10-10",time:"19:00",category:"Festivales",priceClp:15000,capacity:5000};
 const event=createOrganizerEvent(store,"org-aurora",{...base,waitlistEnabled:false});
 assert.equal(event.waitlistEnabled,true,"el cliente no puede desactivar una lista masiva");
 assert.equal(event.maxTicketsPerPerson,7);
 assert.throws(()=>createOrganizerEvent(store,"org-aurora",{...base,maxTicketsPerPerson:101}),/fuera de rango/);
 assert.throws(()=>createOrganizerEvent(store,"org-aurora",{...base,maxTicketsPerPerson:0}),/fuera de rango/);
});
test("la compra directa queda bloqueada si el comprador no fue admitido",()=>{
 const s=seedCommerce(fixture);
 assert.equal(eventRequiresWaitingRoom(s.events.find(e=>e.id===mass)),true);
 assert.deepEqual(waitingRoomStatus(s,mass,buyer(1)).status,"not_joined");
 assert.throws(()=>simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:1,buyerId:buyer(1)}),/turno autorizado/);
 assert.equal(s.orders.length,0);
 const entry=joinWaitingRoom(s,mass,buyer(1));
 assert.equal(entry.required,true);
 assert.equal(entry.status,"admitted");
 assert.ok(entry.expiresAt>Date.now());
 const order=simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:7,buyerId:buyer(1),
  idempotencyKey:"queue-retry-demo-000001"});
 assert.equal(order.quantity,7);
 assert.equal(waitingRoomStatus(s,mass,buyer(1)).status,"used");
 assert.equal(simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:7,buyerId:buyer(1),
  idempotencyKey:"queue-retry-demo-000001"}).id,order.id,"reintento no consume otro turno");
 assert.throws(()=>joinWaitingRoom(s,mass,buyer(1)),/máximo/);
 assert.equal(s.orders.length,1);
});
test("cola FIFO concede solo 25 turnos y atiende al siguiente tras una compra",()=>{
 const s=seedCommerce(fixture);
 for(let n=0;n<WAITLIST_ADMISSION_SLOTS+2;n++)joinWaitingRoom(s,mass,buyer(n));
 const active=s.waitlist.filter(e=>e.status==="admitted");
 assert.equal(active.length,WAITLIST_ADMISSION_SLOTS);
 assert.equal(waitingRoomStatus(s,mass,buyer(25)).status,"waiting");
 assert.equal(waitingRoomStatus(s,mass,buyer(25)).position,1);
 assert.equal(waitingRoomStatus(s,mass,buyer(26)).position,2);
 assert.equal(joinWaitingRoom(s,mass,buyer(26)).position,2,"repetir ingreso no adelanta posiciones");
 assert.throws(()=>simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:1,buyerId:buyer(26)}),/turno autorizado/);
 simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:1,buyerId:buyer(0)});
 assert.equal(waitingRoomStatus(s,mass,buyer(25)).status,"admitted");
 assert.equal(waitingRoomStatus(s,mass,buyer(26)).position,1);
 leaveWaitingRoom(s,mass,buyer(1));
 assert.equal(waitingRoomStatus(s,mass,buyer(26)).status,"admitted");
});
test("los turnos caducan y los compradores pueden volver al final",()=>{
 const s=seedCommerce(fixture);
 const now=Date.now();
 joinWaitingRoom(s,mass,buyer(1),now);
 const first=waitingRoomStatus(s,mass,buyer(1),now);
 assert.equal(first.status,"admitted");
 assert.equal(first.expiresAt,now+WAITLIST_ADMISSION_TTL_MS);
 reconcileWaitingRoom(s,mass,now+WAITLIST_ADMISSION_TTL_MS+1000);
 assert.equal(waitingRoomStatus(s,mass,buyer(1),now+WAITLIST_ADMISSION_TTL_MS+1000).status,"expired");
 assert.throws(()=>simulateOrder(s,{eventId:mass,ticketTypeId:"general",quantity:1,buyerId:buyer(1)}),/turno autorizado/);
 assert.equal(joinWaitingRoom(s,mass,buyer(1)).status,"admitted");
});
