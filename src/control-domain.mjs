// Central control logic for the product owner's PUBLIC DEMONSTRATION only.
// There are no credentials, roles, contracts or actual settlements in this browser.
import { available, cancelSimulatedOrder, createOrganizerEvent } from "./commerce-domain.mjs";

const fail=(m)=>{throw Error(m)};
const integer=(n,min,max,label)=>{const x=Number(n);if(!Number.isSafeInteger(x)||x<min||x>max)fail(label+" inválido");return x;};
const text=(s,min,max,label)=>{const v=String(s??"").trim();if(v.length<min||v.length>max)fail(label+" inválido");return v;};
const event=(store,id)=>store.events.find(e=>e.id===id)||fail("Evento de demostración no encontrado");

export function ownerOverview(store){
 const active=store.orders.filter(o=>o.status==="demo_confirmed");
 const sum=(field)=>active.reduce((acc,o)=>acc+Number(o.pricing?.[field]||0),0);
 return {
  organizers:store.organizers.length,
  activeEvents:store.events.filter(e=>e.status==="published").length,
  pausedEvents:store.events.filter(e=>e.status==="paused").length,
  orders:active.length,
  tickets:active.reduce((acc,o)=>acc+o.quantity,0),
  faceValueClp:sum("faceValueClp"),
  serviceFeeClp:sum("serviceFeeClp"),
  grossClp:sum("totalClp"),
  venueShareClp:sum("venueShareClp"),
  platformGrossFeeClp:sum("platformShareClp"),
  audit:store.audit.length
 };
}
export function ownerEvents(store) {
 return store.events.map(e=>({
   ...e,
   organizerName:store.organizers.find(o=>o.id===e.organizerId)?.name??"Sin organizador",
   issuedDemo:e.ticketTypes.reduce((n,t)=>n+t.capacity-available(store,e.id,t.id),0)
 }));
}
export function ownerOrders(store) {
 return store.orders.map(o=>({
  ...o,
  eventTitle:store.events.find(e=>e.id===o.eventId)?.title??"Evento DEMO",
  organizerName:store.organizers.find(x=>x.id===o.organizerId)?.name??"Organizador DEMO"
 }));
}
export function ownerRegisterPartner(store,{name,shareBps}){
 const normalized=text(name,3,90,"Productor");
 if(store.organizers.some(x=>x.name.toLocaleLowerCase("es")===normalized.toLocaleLowerCase("es")))fail("El productor de demostración ya está registrado");
 const partner={id:"org-demo-"+crypto.randomUUID().slice(0,12),name:normalized+" · DEMO",email:"",venueShareBps:integer(shareBps,0,10000,"Participación"),contractStatus:"test_only"};
 store.organizers.push(partner);
 store.audit.unshift({id:crypto.randomUUID(),action:"Productor ficticio registrado por control central",organizerId:partner.id,entityId:partner.id,at:new Date().toISOString()});
 return partner;
}
export function ownerPublishEvent(store,organizerId,input){
 if(!store.organizers.some(o=>o.id===organizerId))fail("Productor de demostración inexistente");
 return createOrganizerEvent(store,organizerId,input);
}
export function ownerSetEventState(store,eventId,status){
 const e=event(store,eventId);
 if(!["published","paused"].includes(status))fail("Estado inválido");
 if(e.status===status)return e;
 e.status=status;
 store.audit.unshift({id:crypto.randomUUID(),action:status==="published"?"Evento DEMO activado":"Evento DEMO pausado",organizerId:e.organizerId,entityId:eventId,at:new Date().toISOString()});
 return e;
}
export function ownerSetFeePolicy(store,percentBps,fixedClp){
 store.contract.buyerFeeBps=integer(percentBps,0,4000,"Comisión porcentual");
 store.contract.buyerFeeFixedClp=integer(fixedClp,0,20000,"Comisión fija");
 store.audit.unshift({id:crypto.randomUUID(),action:"Tarifa DEMO del operador actualizada",organizerId:"owner",entityId:"commission",at:new Date().toISOString()});
 return store.contract;
}
export function ownerSetShare(store,partnerId,shareBps){
 const partner=store.organizers.find(o=>o.id===partnerId)||fail("Productor inexistente");
 partner.venueShareBps=integer(shareBps,0,10000,"Participación de recinto");
 store.audit.unshift({id:crypto.randomUUID(),action:"Participación B2B DEMO modificada",organizerId:partnerId,entityId:partnerId,at:new Date().toISOString()});
 return partner;
}
export function ownerCancelDemo(store,orderId){
 const order=store.orders.find(o=>o.id===orderId)||fail("Pedido de prueba inexistente");
 return cancelSimulatedOrder(store,order.organizerId,order.id);
}
export function ownerReferenceCatalog(references) {
 return (references.events||[]).map(x=>({...x,authorization:"not_authorized",saleEnabled:false,fee:null,price:null,orders:0}));
}
