// PaseListo waiting room for LOCAL DEMO orders, not a production ticket queue.
// User identity is supplied only by an authenticated server session.
// All mutating operations must run under a serialized or transactional backend.
export const MASSIVE_EVENT_CAPACITY=5000;
export const WAITLIST_ADMISSION_SLOTS=25;
export const WAITLIST_ADMISSION_TTL_MS=10*60*1000;
export const WAITLIST_MAX_ENTRIES=10000;
export const WAITLIST_PENDING_TTL_MS=24*60*60*1000;

const fail=message=>{throw new Error(message);};
const validId=id=>typeof id==="string"&&id.length>=8&&id.length<=128;
export function eventRequiresWaitingRoom(event){
 if(!event)return false;
 const total=Array.isArray(event.ticketTypes)?
  event.ticketTypes.reduce((sum,t)=>sum+Number(t.capacity||0),0):Number(event.capacity||0);
 return event.waitlistEnabled===true || total>=MASSIVE_EVENT_CAPACITY;
}
export function validateWaitingRoomSetting(capacity,enabled){
 if(typeof capacity!=="number"||!Number.isSafeInteger(capacity)||capacity<1)
  fail("Aforo de lista de espera inválido");
 if(enabled!==undefined&&typeof enabled!=="boolean")
  fail("Activación de lista de espera inválida");
 return enabled===true || capacity>=MASSIVE_EVENT_CAPACITY;
}
function queue(store){if(!Array.isArray(store.waitlist))store.waitlist=[];return store.waitlist;}
function eventFor(store,eventId){
 const event=store.events?.find(e=>e.id===eventId&&e.status==="published");
 if(!event)fail("Evento DEMO no publicado o desconocido");
 return event;
}
function eventEntries(store,eventId){return queue(store).filter(e=>e.eventId===eventId);}
function purchased(store,eventId,buyerId){
 return store.orders.filter(e=>e.eventId===eventId&&e.buyerId===buyerId&&e.status==="demo_confirmed")
  .reduce((sum,e)=>sum+e.quantity,0);
}
function eventLimit(event){
 const max=event.maxTicketsPerPerson??7;
 if(!Number.isSafeInteger(max)||max<1||max>100)fail("Límite de entradas inválido");
 return max;
}
export function reconcileWaitingRoom(store,eventId,now=Date.now()){
 const event=eventFor(store,eventId);
 if(!eventRequiresWaitingRoom(event))return;
 if(!Number.isFinite(now))fail("Hora inválida");
 const all=eventEntries(store,eventId);
 for(const e of all){
  if(e.status==="admitted"&&e.expiresAt<=now)e.status="expired";
  if(e.status==="waiting"&&e.joinedAt+WAITLIST_PENDING_TTL_MS<=now)e.status="expired";
 }
 const admitted=all.filter(e=>e.status==="admitted").length;
 const waiting=all.filter(e=>e.status==="waiting")
  .sort((a,b)=>a.joinedAt-b.joinedAt||a.sequence-b.sequence);
 for(const entry of waiting.slice(0,Math.max(0,WAITLIST_ADMISSION_SLOTS-admitted))){
  entry.status="admitted";entry.admittedAt=now;entry.expiresAt=now+WAITLIST_ADMISSION_TTL_MS;
 }
}
export function waitingRoomStatus(store,eventId,buyerId,now=Date.now()){
 const event=eventFor(store,eventId);
 if(!validId(buyerId))fail("Sesión de comprador inválida");
 if(!eventRequiresWaitingRoom(event))return {required:false,status:"disabled",position:0};
 reconcileWaitingRoom(store,eventId,now);
 const entries=eventEntries(store,eventId);
 const row=entries.find(e=>e.buyerId===buyerId);
 if(!row)return {required:true,status:"not_joined",position:null};
 let position=null;
 if(row.status==="waiting"){
  const waiting=entries.filter(e=>e.status==="waiting")
   .sort((a,b)=>a.joinedAt-b.joinedAt||a.sequence-b.sequence);
  position=waiting.findIndex(e=>e.buyerId===buyerId)+1;
 }
 return {required:true,status:row.status,position,expiresAt:row.status==="admitted"?row.expiresAt:null};
}
export function joinWaitingRoom(store,eventId,buyerId,now=Date.now()){
 const event=eventFor(store,eventId);
 if(!eventRequiresWaitingRoom(event))fail("Este evento no requiere lista de espera");
 if(!validId(buyerId))fail("Sesión de comprador inválida");
 if(purchased(store,eventId,buyerId)>=eventLimit(event))
  fail("Ya alcanzaste el máximo de boletos para este evento");
 reconcileWaitingRoom(store,eventId,now);
 const list=queue(store);
 const active=list.filter(e=>e.eventId===eventId&&["waiting","admitted"].includes(e.status));
 let row=list.find(e=>e.eventId===eventId&&e.buyerId===buyerId);
 if(!row||!["waiting","admitted"].includes(row.status)){
  if(active.length>=WAITLIST_MAX_ENTRIES)fail("Lista de espera temporalmente completa");
  if(row){row.joinedAt=now;row.sequence=Math.max(0,...list.map(e=>e.sequence||0))+1;
   row.status="waiting";row.expiresAt=null;}
  else list.push({eventId,buyerId,joinedAt:now,
   sequence:Math.max(0,...list.map(e=>e.sequence||0))+1,status:"waiting",expiresAt:null});
 }
 return waitingRoomStatus(store,eventId,buyerId,now);
}
export function leaveWaitingRoom(store,eventId,buyerId,now=Date.now()){
 const event=eventFor(store,eventId);
 if(!eventRequiresWaitingRoom(event))return {required:false,status:"disabled",position:0};
 const row=eventEntries(store,eventId).find(e=>e.buyerId===buyerId);
 if(row&&["waiting","admitted"].includes(row.status))row.status="cancelled";
 reconcileWaitingRoom(store,eventId,now);
 return waitingRoomStatus(store,eventId,buyerId,now);
}
export function useWaitingRoomAdmission(store,eventId,buyerId,now=Date.now()){
 const event=eventFor(store,eventId);
 if(!eventRequiresWaitingRoom(event))return false;
 const status=waitingRoomStatus(store,eventId,buyerId,now);
 if(status.status!=="admitted")fail("Debes esperar tu turno autorizado antes de comprar");
 const row=eventEntries(store,eventId).find(e=>e.buyerId===buyerId);
 row.status="used";row.expiresAt=null;
 reconcileWaitingRoom(store,eventId,now);
 return true;
}
