import { loadCommerce, publishedEvents, available, quote } from "./commerce-domain.mjs";
import { createCheckoutState, canSubmitCheckout } from "./checkout-state.mjs";
import { eventDetailHref } from "./event-page-domain.mjs";
import { renderWeekStrip } from "./week-events.mjs";
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normalize=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const clp=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
const date=s=>new Intl.DateTimeFormat("es-CL",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).format(new Date(s+"T12:00:00Z"));
const short=s=>new Intl.DateTimeFormat("es-CL",{timeZone:"UTC",day:"numeric",month:"short"}).format(new Date(s+"T12:00:00Z")).replace(".","");
const current=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
let store=null;
let realSamples=[];
const ui={query:"",category:"Todos",city:"all",period:"all",eventId:null,checkout:null,lastFocus:null,authPending:null};
let buyer=null;
let buyerApiReady=false;
let serverInventory=null;
function remainingFor(eventId,typeId){
 // The local demo server owns stock. Never offer browser-only events as purchasable.
 if(serverInventory!==null)return serverInventory.get(eventId+"|"+typeId)?.remaining??0;
 return available(store,eventId,typeId);
}
async function refreshInventory(){
 if(!buyerApiReady){serverInventory=null;return;}
 try{
  const data=await buyerRequest("inventory",undefined,"GET");
  if(!Array.isArray(data.events))throw Error("Inventario inválido");
  const next=new Map();
  for(const event of data.events){
   if(typeof event.eventId!=="string"||!Array.isArray(event.ticketTypes))continue;
   for(const ticket of event.ticketTypes){
    if(typeof ticket.ticketTypeId==="string"&&Number.isSafeInteger(ticket.remaining)&&ticket.remaining>=0&&
       Number.isSafeInteger(ticket.unitBaseClp)&&ticket.unitBaseClp>=0&&
       Number.isSafeInteger(ticket.feePerTicketClp)&&ticket.feePerTicketClp>=0)
     next.set(event.eventId+"|"+ticket.ticketTypeId,{
      remaining:ticket.remaining,unitBaseClp:ticket.unitBaseClp,feePerTicketClp:ticket.feePerTicketClp
     });
   }
  }
  serverInventory=next;
  if(store){renderCards();syncDetailAvailability();}
 }catch{
  // Fail closed when the buyer API is reachable but its inventory cannot be verified.
  serverInventory=buyerApiReady?new Map():null;
  if(store){renderCards();syncDetailAvailability();}
 }
}
function allEvents(){return publishedEvents(store).filter(e=>e.date>=current()).sort((a,b)=>a.date.localeCompare(b.date));}
function realEvents(){return realSamples.filter(e=>(e.endDate||e.date)>=current()).sort((a,b)=>a.date.localeCompare(b.date));}
function allCatalogEvents(){return [...realEvents(),...allEvents()];}
function org(id){return store.organizers.find(o=>o.id===id);}
function minPrice(event){return Math.min(...event.ticketTypes.map(t=>quoteOrPrice(event,t)));}
function pricePreview(eventId,typeId,qty){
 if(serverInventory!==null){
  const ticket=serverInventory.get(eventId+"|"+typeId);
  if(!ticket)throw Error("Esta entrada no está disponible en el servidor DEMO");
  const faceValueClp=ticket.unitBaseClp*qty;
  const serviceFeeClp=ticket.feePerTicketClp*qty;
  return {faceValueClp,serviceFeeClp,totalClp:faceValueClp+serviceFeeClp};
 }
 return quote(store,eventId,typeId,qty,{availabilityRequired:false});
}
function quoteOrPrice(event,type){try{return pricePreview(event.id,type.id,1).totalClp;}catch{return type.priceClp;}}
function poster(event){
 const tone=/^#[0-9a-f]{6}$/i.test(event.accent||"")?event.accent:"#CFF47A";
 let image="";
 if(event.posterUrl&&event.posterRights==="declarados_por_usuario_sin_verificar"){
  try{const url=new URL(event.posterUrl);if(url.protocol==="https:")image='<img src="'+esc(url.href)+'" alt="Cartel cargado por organizador DEMO, autorización no verificada" class="poster-img owner-poster" loading="lazy" decoding="async" referrerpolicy="no-referrer">';}catch{/* no image */}
 }
 return '<div class="poster-frame demo-poster" style="--poster-accent:'+tone+'"><div class="demo-poster-inner"><span class="demo-art-top">PASELISTO · EVENTO DEMO</span><span class="demo-art-symbol">✳</span><span class="demo-art-title">'+esc(event.title)+'</span><span class="demo-art-subtitle">'+esc(event.subtitle)+'</span><span class="demo-art-bottom">'+esc(event.city)+' / '+esc(event.date)+'</span></div>'+image+'</div>';
}


function realPoster(event,eager=false){
 const tone=/^#[0-9a-f]{6}$/i.test(event.accent||"")?event.accent:"#E9D8BF";
 let src="",backup="";
 try{const u=new URL(event.posterUrl);if(u.protocol==="https:")src=u.href;}catch{/* Visible fallback */}
 try{const u=new URL(event.posterFallbackUrl);if(u.protocol==="https:")backup=u.href;}catch{/* No secondary source */}
 return '<div class="poster-frame real-poster" style="--poster-accent:'+tone+'">'+
  '<div class="demo-poster-inner"><span class="demo-art-top">CARTEL NO DISPONIBLE</span><span class="demo-art-symbol">✳</span><span class="demo-art-title">'+esc(event.title)+'</span><span class="demo-art-bottom">AFICHE DE TERCERO · REFERENCIA</span></div>'+
  (src?'<img src="'+esc(src)+'"'+(backup?' data-fallback="'+esc(backup)+'"':"")+' alt="Afiche promocional de '+esc(event.title)+'" class="poster-img reference-poster" loading="'+(eager?"eager":"lazy")+'" decoding="async" referrerpolicy="no-referrer">':"")+'</div>';
}
function realCard(event){
 return '<article class="event-card reference-event">'+
  '<div class="poster-button">'+realPoster(event)+'</div>'+
  '<div class="event-information"><div class="event-taxonomy">'+esc(event.category)+'<span>✳</span>'+esc(event.city)+'</div>'+
  '<h3 class="card-heading">'+esc(event.title)+'</h3>'+
  '<p class="event-subtitle">'+esc(event.subtitle)+'</p>'+
  '<div class="event-meta"><span>'+esc(short(event.date))+'</span><span class="meta-dot">·</span><span>'+esc(event.venue)+'</span></div>'+
  '<div class="event-bottom real-bottom"><span>Solo referencia · Sin venta</span><span aria-hidden="true">↗</span></div></div>'+
  '<button class="card-hitbox" type="button" data-real-detail="'+esc(event.id)+'" aria-label="Ver ficha de '+esc(event.title)+'. Ejemplo sin venta en PaseListo"></button></article>';
}
function openRealDetail(id){
 const e=realSamples.find(x=>x.id===id);if(!e)return;
 ui.eventId=null;
 ui.lastFocus=document.activeElement;
 const end=e.endDate&&e.endDate!==e.date?" al "+date(e.endDate):"";
 $("#detail-content").innerHTML='<div class="detail-layout"><div class="detail-cover">'+realPoster(e)+'<span class="detail-art-label">AFICHE PROMOCIONAL DE TERCERO · LICENCIA NO ACREDITADA</span></div>'+
  '<div class="detail-info"><div class="detail-kicker">REFERENCIA VISUAL · NO A LA VENTA</div>'+
  '<h2 id="detail-title">'+esc(e.title)+'</h2><p class="detail-subtitle">'+esc(e.subtitle)+'</p>'+
  '<p class="detail-editorial">Este es un espectáculo real utilizado para mostrar cómo se vería una publicación de gran formato en PaseListo. <strong>El productor no ha contratado a PaseListo</strong> y aquí no existe inventario, precio ni opción de compra.</p>'+
  '<dl class="event-facts"><div><dt>Fecha</dt><dd>'+esc(date(e.date))+esc(end)+'</dd></div>'+
  '<div><dt>Recinto</dt><dd>'+esc(e.venue)+' · '+esc(e.city)+'</dd></div>'+
  '<div><dt>Organiza</dt><dd>'+esc(e.organizer)+'</dd></div></dl>'+
  '<div class="reference-disclaimer"><strong>Venta en PaseListo no habilitada.</strong><p>Para habilitar una ficha comercial, nuestro equipo debe acreditar el contrato B2B, permisos sobre el cartel, cupos y condiciones de venta.</p></div>'+
  
  '<small class="reference-rights">'+esc(e.posterCredit||"Afiche promocional externo")+' · reproducción comercial pendiente de autorización.</small></div></div>';
 $("#detail-backdrop").hidden=false;document.body.classList.add("dialog-open");$("#event-dialog").focus();installImages();
}


function card(event){
 return '<article class="event-card">'+
  '<div class="poster-button">'+poster(event)+'</div>'+
  '<div class="event-information"><div class="event-taxonomy">'+esc(event.category)+'<span>✳</span>'+esc(event.city)+'</div>'+
  '<h3 class="card-heading">'+esc(event.title)+'</h3>'+
  '<p class="event-subtitle">'+esc(event.subtitle)+'</p><div class="event-meta"><span>'+esc(short(event.date))+'</span><span class="meta-dot">·</span><span>'+esc(event.venue)+'</span></div>'+
  '<div class="event-bottom"><span>Desde '+clp(minPrice(event))+' · total DEMO</span><span aria-hidden="true">↗</span></div></div>'+
  '<button class="card-hitbox" type="button" data-detail="'+esc(event.id)+'" aria-label="Ver entradas de prueba para '+esc(event.title)+'"></button></article>';
}
function installImages(){
 $$(".owner-poster, .reference-poster").forEach(img=>{
  if(img.dataset.imageBound==="1")return;
  img.dataset.imageBound="1";
  const frame=img.closest(".poster-frame");
  const loaded=()=>{if(img.naturalWidth>0)frame?.classList.add("loaded");};
  const failed=()=>{
   const fallback=img.dataset.fallback;
   if(fallback&&!img.dataset.tried){img.dataset.tried="1";img.src=fallback;return;}
   frame?.classList.add("image-failed");
   img.remove();
  };
  img.addEventListener("load",loaded,{once:true});
  img.addEventListener("error",failed);
  if(img.complete){if(img.naturalWidth>0)loaded();else failed();}
 });
}
function filters(){
 const categories=["Todos","Música","Festivales","Comedia","Teatro","Familia","Experiencias"];
 $("#category-list").innerHTML=categories.map(c=>'<button type="button" class="category-chip'+(ui.category===c?" active":"")+'" data-category="'+esc(c)+'" aria-pressed="'+(ui.category===c)+'">'+esc(c)+'</button>').join("");
 const cities=[...new Set(allCatalogEvents().map(e=>e.city))].sort((a,b)=>a.localeCompare(b,"es"));
 const previous=ui.city;
 $("#city-filter").innerHTML='<option value="all">Todas las ciudades</option>'+cities.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
 if(cities.includes(previous))$("#city-filter").value=previous;else{ui.city="all";$("#city-filter").value="all";}
}
function matches(event){
 const now=current(),to=new Date(now+"T12:00:00Z");to.setUTCDate(to.getUTCDate()+30);
 const cutoff=to.toISOString().slice(0,10);
 if(ui.category!=="Todos"&&event.category!==ui.category)return false;
 if(ui.city!=="all"&&event.city!==ui.city)return false;
 if(ui.period==="month"&&event.date.slice(0,7)!==now.slice(0,7))return false;
 if(ui.period==="thirty"&&event.date>cutoff)return false;
 if(ui.period==="later"&&event.date<=cutoff)return false;
 return !ui.query||normalize([event.title,event.subtitle,event.city,event.venue,event.category,event.genre].join(" ")).includes(normalize(ui.query));
}
function renderCards(){
 const events=allEvents(),filtered=events.filter(matches);
 const real=realEvents().filter(matches);
 $("#real-events-grid").innerHTML=real.map(realCard).join("");
 $("#events-grid").innerHTML=filtered.map(card).join("");
 $("#event-count").textContent=(events.length+realEvents().length)+" fichas de ejemplo";
 $("#results-description").textContent=real.length+" referencias reales y "+filtered.length+" eventos de compra DEMO";
 $("#empty-state").hidden=(filtered.length+real.length)>0;
 $("#clear-filters").hidden=!ui.query&&ui.category==="Todos"&&ui.city==="all"&&ui.period==="all";
 $$("[data-category]").forEach(el=>{el.classList.toggle("active",el.dataset.category===ui.category);el.setAttribute("aria-pressed",String(el.dataset.category===ui.category));});
 installImages();
}

function renderFeatured(){
 const first=realEvents().find(e=>e.featured)||realEvents()[0]||null;
 if(first)$("#hero-poster").innerHTML='<button class="hero-art-button" type="button" data-real-detail="'+esc(first.id)+'" aria-label="Ver ficha de '+esc(first.title)+'">'+realPoster(first,true)+'<span class="hero-poster-bottom"><small>EVENTO DE REFERENCIA · SIN VENTA</small><strong>'+esc(first.title)+' ↗</strong></span></button>';
 else $("#hero-poster").innerHTML='<div class="hero-no-poster"><span>✳</span><strong>Eventos en vivo.</strong></div>';
 installImages();
}
function selectedEvent(id){return store.events.find(e=>e.id===id&&e.status==="published");}
function syncDetailAvailability(){
 if($("#detail-backdrop").hidden||!ui.eventId)return;
 const event=selectedEvent(ui.eventId);
 if(!event)return;
 $("[data-remaining-type]",$("#detail-content")).forEach(node=>{
  const type=event.ticketTypes.find(t=>t.id===node.dataset.remainingType);
  if(type)node.textContent=remainingFor(event.id,type.id)+" cupos de prueba · valor base "+clp(type.priceClp);
 });
 $("[data-select-ticket]",$("#detail-content")).forEach(button=>{
  button.disabled=remainingFor(event.id,button.dataset.selectTicket)<1;
 });
}
function openDetail(id){
 const event=selectedEvent(id);if(!event)return;
 ui.lastFocus=document.activeElement;ui.eventId=id;
 const organizer=org(event.organizerId);
 const rows=event.ticketTypes.map(t=>'<div class="type-row"><div><strong>'+esc(t.name)+'</strong><small data-remaining-type="'+esc(t.id)+'">'+remainingFor(event.id,t.id)+' cupos de prueba · valor base '+clp(t.priceClp)+'</small></div><div><strong>'+clp(quoteOrPrice(event,t))+'</strong><button type="button" data-select-ticket="'+esc(t.id)+'" data-event="'+esc(event.id)+'" '+(remainingFor(event.id,t.id)<1?"disabled":"")+'>Iniciar sesión para comprar ↗</button></div></div>').join("");
 $("#detail-content").innerHTML='<div class="detail-layout"><div class="detail-cover">'+poster(event)+'<span class="detail-art-label">ARTE FICTICIO · NO OFICIAL</span></div><div class="detail-info"><div class="detail-kicker">'+esc(event.category)+' <span>✳</span> '+esc(event.city)+'</div><h2 id="detail-title">'+esc(event.title)+'</h2><p class="detail-subtitle">'+esc(event.subtitle)+'</p><p class="detail-editorial">'+esc(event.description)+'</p><dl class="event-facts"><div><dt>Fecha</dt><dd>'+esc(date(event.date))+' · '+esc(event.time)+' h</dd></div><div><dt>Recinto</dt><dd>'+esc(event.venue)+'</dd></div><div><dt>Organiza</dt><dd>'+esc(organizer?.name||"Organizador")+'</dd></div></dl><div class="type-list"><h3>Elige una entrada</h3>'+rows+'</div><p class="detail-important">Precios finales de demostración en CLP, incluidos los cargos de servicio simulados. No hay venta ni emisión de tickets utilizables.</p></div></div>';
 $("#detail-backdrop").hidden=false;document.body.classList.add("dialog-open");$("#event-dialog").focus();
}
function closeModal(which,restore=true){
 const node=$(which);node.hidden=true;
 if(which==="#checkout-backdrop")ui.checkout=null;
 if(which==="#detail-backdrop")ui.eventId=null;
 if(["#detail-backdrop","#checkout-backdrop","#login-backdrop","#orders-backdrop"].every(selector=>$(selector).hidden))document.body.classList.remove("dialog-open");
 if(restore&&ui.lastFocus?.isConnected)ui.lastFocus.focus();
}

async function buyerRequest(path,payload,method="POST"){
 const headers={"Accept":"application/json","X-PaseListo-Request":"1"};
 if(payload!==undefined)headers["Content-Type"]="application/json";
 const response=await fetch("/api/buyer/"+path,{method,credentials:"same-origin",headers,...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=Error(data.error||"No fue posible completar la solicitud");
  error.status=response.status;
  throw error;
 }
 return data;
}
async function refreshBuyer(){
 try {
  const status=await buyerRequest("status",undefined,"GET");
  buyerApiReady=status.ready===true&&status.mode==="local-demo";
  if(!buyerApiReady){buyer=null;serverInventory=null;return false;}
  const response=await buyerRequest("session",undefined,"GET");
  buyer=response.authenticated===true?response.buyer:null;
 }catch{buyerApiReady=false;buyer=null;serverInventory=null;}
 const trigger=$("#buyer-account-trigger");
 if(trigger)trigger.textContent=buyer?"Mi cuenta":"Iniciar sesión";
 return buyerApiReady;
}
function renderLoginForm(mode="login",message=""){
 const root=$("#buyer-auth-content");
 if(!buyerApiReady){
  root.innerHTML='<div class="reference-disclaimer" role="status"><strong>Inicio de sesión no disponible en GitHub Pages.</strong><p>La compra está bloqueada hasta conectar el servidor de autenticación. No ingreses contraseñas en esta página.</p></div>';
  return;
 }
 root.innerHTML='<form id="buyer-auth-form" class="buyer-auth-form" data-mode="'+esc(mode)+'">'+
  '<label>Correo electrónico<input type="email" name="email" autocomplete="email" maxlength="120" placeholder="correo@ejemplo.cl" required></label>'+
  '<label>Contraseña<input type="password" name="password" autocomplete="'+(mode==="register"?"new-password":"current-password")+'" minlength="12" maxlength="128" required></label>'+
  (mode==="register"?'<small>Utiliza datos ficticios y una contraseña exclusiva para esta demo local.</small>':'')+
  '<button type="submit" class="checkout-submit">'+(mode==="register"?"Crear cuenta de prueba":"Iniciar sesión")+'</button>'+
  '<p id="login-feedback" role="status" class="buyer-auth-feedback">'+esc(message)+'</p>'+
  '<button class="switch-auth" type="button" data-switch-auth="'+(mode==="login"?"register":"login")+'">'+(mode==="login"?"Crear cuenta de prueba":"Ya tengo cuenta · Ingresar")+'</button></form>';
}
async function showLogin(eventId=null,typeId=null){
 ui.authPending=eventId&&typeId?{eventId,typeId}:null;
 closeModal("#detail-backdrop",false);
 if(!$("#checkout-backdrop").hidden)closeModal("#checkout-backdrop",false);
 if(!$("#orders-backdrop").hidden)closeModal("#orders-backdrop",false);
 await refreshBuyer();
 $("#login-backdrop").hidden=false;document.body.classList.add("dialog-open");
 renderLoginForm();
 $("#login-dialog").focus();
}
function closeLogin(){
 closeModal("#login-backdrop");ui.authPending=null;
}
function renderCheckout(eventId,typeId,qty=1){
 if(!buyer||!buyerApiReady){showLogin(eventId,typeId);return;}
 const e=selectedEvent(eventId);if(!e)return;
 ui.checkout=createCheckoutState(ui.checkout,eventId,typeId,qty);
 const ticket=e.ticketTypes.find(t=>t.id===typeId);if(!ticket)return;
 const remaining=remainingFor(eventId,typeId),insufficient=!canSubmitCheckout(ui.checkout,remaining);
 let summary;
 try{summary=pricePreview(eventId,typeId,qty);}catch(err){$("#checkout-content").innerHTML='<p class="load-error">'+esc(err.message)+'</p>';return;}
 $("#checkout-content").innerHTML='<div class="checkout-head"><div class="detail-kicker">CUENTA VERIFICADA · COMPRA DE PRUEBA</div><h2 id="checkout-title">Tus entradas.</h2><p>'+esc(e.title)+' · '+esc(date(e.date))+' · '+esc(e.venue)+'</p><p class="signed-buyer">Sesión iniciada: '+esc(buyer.email)+'</p></div><form id="demo-checkout" class="checkout-form"><div class="checkout-controls"><label>Tipo de entrada<select name="ticketType">'+e.ticketTypes.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===typeId?"selected":"")+'>'+esc(t.name)+'</option>').join("")+'</select></label><label>Cantidad<select name="quantity">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(n===qty?"selected":"")+'>'+n+'</option>').join("")+'</select></label></div><div class="fee-summary"><div><span>Entrada base × '+qty+'</span><strong>'+clp(summary.faceValueClp)+'</strong></div><div><span>Cargo por servicio × '+qty+'</span><strong>'+clp(summary.serviceFeeClp)+'</strong></div><div class="fee-total"><span>Total del comprador</span><strong>'+clp(summary.totalClp)+'</strong></div><small>Los cargos de esta simulación están incluidos. No se efectuará ningún cobro.</small></div>'+(insufficient?'<p class="load-error" role="alert">Solo quedan '+remaining+' cupos de prueba para esta selección.</p>':'')+'<label class="ack"><input type="checkbox" required name="acceptDemo"> Entiendo que es una simulación sin pago, reserva ni boleto válido.</label><button type="submit" class="checkout-submit" '+(insufficient?'disabled':'')+'>Continuar pedido de prueba · '+clp(summary.totalClp)+' ↗</button></form>';
}
async function openCheckout(eventId,typeId){
 closeModal("#detail-backdrop",false);
 await refreshBuyer();
 if(!buyer){await showLogin(eventId,typeId);return;}
 await refreshInventory();
 if(remainingFor(eventId,typeId)<1){openDetail(eventId);return;}
 ui.lastFocus=document.activeElement;
 $("#checkout-backdrop").hidden=false;document.body.classList.add("dialog-open");
 ui.checkout=null;
 renderCheckout(eventId,typeId,1);$("#checkout-dialog").focus();
}
function orderSuccess(order){
 ui.checkout=null;
 refreshInventory().catch(()=>{});
 const event=selectedEvent(order.eventId);
 $("#checkout-content").innerHTML='<div class="demo-success"><div class="success-symbol" aria-hidden="true">✓</div><div class="detail-kicker">PEDIDO DE PRUEBA REGISTRADO</div><h2 id="checkout-title">¡Simulación completada!</h2><p>Este registro de prueba está asociado a tu cuenta de desarrollo. No hay pago, reserva real ni entrada válida.</p><div class="demo-receipt"><span>N.º de simulación</span><strong>'+esc(order.id)+'</strong><span>Evento</span><strong>'+esc(event?.title||"Evento DEMO")+'</strong><span>Total teórico</span><strong>'+clp(order.pricing.totalClp)+'</strong></div><button type="button" data-close-checkout class="checkout-submit">Volver a la cartelera ↗</button></div>';
}
function orderDate(value){
 const d=new Date(value);
 return Number.isFinite(d.getTime())
  ?new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeZone:"America/Santiago"}).format(d)
  :"Fecha no disponible";
}
async function showAccount(){
 await refreshBuyer();
 if(!buyer){await showLogin();return;}
 ui.lastFocus=document.activeElement;
 $("#orders-backdrop").hidden=false;
 document.body.classList.add("dialog-open");
 $("#orders-dialog").focus();
 const content=$("#buyer-orders-content");
 content.textContent="Cargando pedidos de prueba…";
 try{
  const response=await buyerRequest("orders",undefined,"GET");
  if($("#orders-backdrop").hidden)return;
  const orders=Array.isArray(response.orders)?response.orders:[];
  const cards=orders.slice(0,50).map(order=>{
   const event=store?.events.find(e=>e.id===order.eventId);
   const status=order.status==="demo_confirmed"?"Registrado · DEMO":"Anulado · DEMO";
   const amount=Number.isFinite(order.pricing?.totalClp)?order.pricing.totalClp:0;
   return '<article class="buyer-order-card"><div class="buyer-order-top"><strong>'+esc(event?.title||"Evento de prueba")+'</strong><span>'+esc(status)+'</span></div>'+
    '<p>'+esc(order.id)+' · '+esc(order.quantity)+' entrada(s) · '+esc(orderDate(order.createdAt))+'</p>'+
    '<div class="buyer-order-total"><span>Valor simulado</span><strong>'+clp(amount)+'</strong></div></article>';
  }).join("");
  content.innerHTML=orders.length
   ?'<p class="orders-count">'+orders.length+' pedido(s) de prueba · se muestran hasta 50 recientes</p><div class="buyer-orders-list">'+cards+'</div>'
   :'<p class="orders-empty">Todavía no tienes pedidos de prueba.</p>';
 }catch(err){
  if(!$("#orders-backdrop").hidden)content.textContent=err.message;
 }
}
function resetFilters(){ui.query="";ui.category="Todos";ui.city="all";ui.period="all";$("#event-search").value="";$("#date-filter").value="all";filters();renderCards();}
async function start(){
 try{
  const [response,realResponse]=await Promise.all([
   fetch("./data/eventos-clientes-demo.json",{cache:"no-cache"}),
   fetch("./data/eventos-reales-referencia.json",{cache:"no-cache"})
  ]);
  if(!response.ok||!realResponse.ok)throw Error("Catálogos no disponibles");
  const catalog=await response.json(),visuals=await realResponse.json();
  store=loadCommerce(catalog);
  realSamples=Array.isArray(visuals.events)?visuals.events:[];
  filters();renderCards();renderFeatured();
  renderWeekStrip(realSamples,publishedEvents(store));
  refreshBuyer().then(refreshInventory).catch(()=>{});
 }catch(err){
  $("#hero-poster").innerHTML='<div class="hero-no-poster"><strong>Catálogo temporalmente no disponible.</strong></div>';
  $("#events-grid").innerHTML='<p class="load-error">Intenta recargar la plataforma.</p>';
  console.error("PaseListo",err.message);return;
 }
 $("#event-search").addEventListener("input",ev=>{ui.query=ev.target.value;renderCards();});
 $("#city-filter").addEventListener("change",ev=>{ui.city=ev.target.value;renderCards();});
 $("#date-filter").addEventListener("change",ev=>{ui.period=ev.target.value;renderCards();});
 $("#clear-filters").addEventListener("click",resetFilters);
 document.addEventListener("click",ev=>{
  const target=ev.target;
  const real=target.closest("[data-real-detail]");
  if(real){location.assign(eventDetailHref(real.dataset.realDetail));return;}
  const d=target.closest("[data-detail]");
  if(d){location.assign(eventDetailHref(d.dataset.detail));return;}
  const cat=target.closest("[data-category]");
  if(cat){ui.category=cat.dataset.category;renderCards();return;}
  const type=target.closest("[data-select-ticket]");
  if(type){openCheckout(type.dataset.event,type.dataset.selectTicket).catch(e=>alert(e.message));return;}
  if(target.closest("[data-close-login]")||target.id==="login-backdrop"){closeLogin();return;}
  if(target.closest("[data-close-orders]")||target.id==="orders-backdrop"){closeModal("#orders-backdrop");return;}
  const switchAuth=target.closest("[data-switch-auth]");
  if(switchAuth){renderLoginForm(switchAuth.dataset.switchAuth);return;}
  if(target.closest("[data-close-detail]")||target.id==="detail-backdrop"){closeModal("#detail-backdrop");return;}
  if(target.closest("[data-close-checkout]")||target.id==="checkout-backdrop"){closeModal("#checkout-backdrop");renderCards();return;}
  if(target.closest("[data-clear-filters]"))resetFilters();
 });
 $("#checkout-content").addEventListener("change",ev=>{
  if(!ui.checkout)return;
  if(!["ticketType","quantity"].includes(ev.target.name))return;
  const form=ev.target.form;if(!form)return;
  const type=form.elements.ticketType.value,qty=Number(form.elements.quantity.value);
  renderCheckout(ui.checkout.eventId,type,qty);
 });

 $("#buyer-account-trigger").addEventListener("click",()=>{
  showAccount().catch(err=>console.error("PaseListo",err.message));
 });
 $("#buyer-logout").addEventListener("click",async()=>{
  const button=$("#buyer-logout");
  button.disabled=true;
  try{
   await buyerRequest("logout",{});
   buyer=null;
   closeModal("#orders-backdrop");
   await refreshBuyer();
  }catch(err){
   $("#buyer-orders-content").textContent=err.message;
  }finally{button.disabled=false;}
 });
 $("#buyer-auth-content").addEventListener("submit",async ev=>{
  if(ev.target.id!=="buyer-auth-form")return;
  ev.preventDefault();
  const fd=new FormData(ev.target),mode=ev.target.dataset.mode,feedback=$("#login-feedback");
  const email=String(fd.get("email")||""),password=String(fd.get("password")||"");
  try{
   await buyerRequest(mode==="register"?"register":"login",{email,password});
   ev.target.reset();
   await refreshBuyer();
   if(!buyer)throw Error("La cuenta no pudo verificarse");
   const next=ui.authPending;
   closeLogin();
   if(next)await openCheckout(next.eventId,next.typeId);
  }catch(err){if(feedback)feedback.textContent=err.message;}
 });
 $("#checkout-content").addEventListener("submit",async ev=>{
  if(ev.target.id!=="demo-checkout")return;
  ev.preventDefault();
  const checkout=ui.checkout,form=ev.target;
  if(!checkout||checkout.submitting)return;
  if(form.elements.ticketType.value!==checkout.typeId||Number(form.elements.quantity.value)!==checkout.qty)return;
  checkout.submitting=true;
  const button=form.querySelector('[type="submit"]'),buttonText=button?.textContent;
  const controls=[...form.querySelectorAll("select")];
  if(button){button.disabled=true;button.textContent="Registrando pedido de prueba…";}
  controls.forEach(control=>{control.disabled=true;});
  try{
   await refreshBuyer();
   if(!buyer){await showLogin(checkout.eventId,checkout.typeId);return;}
   checkout.attempted=true;
   const order=await buyerRequest("orders",{
    eventId:checkout.eventId,
    ticketTypeId:checkout.typeId,
    quantity:checkout.qty,
    requestId:checkout.requestId
   });
   if(ui.checkout===checkout)orderSuccess(order);
  }catch(err){
   if(err.status===409)checkout.attempted=false;
   await refreshInventory();
   if(ui.checkout===checkout&&form.isConnected){
    if(!canSubmitCheckout(checkout,remainingFor(checkout.eventId,checkout.typeId))){
     renderCheckout(checkout.eventId,checkout.typeId,checkout.qty);
     return;
    }
    form.querySelector('[role="alert"]')?.remove();
    const error=document.createElement("p");
    error.className="load-error";error.setAttribute("role","alert");error.textContent=err.message;form.prepend(error);
   }
  }finally{
   checkout.submitting=false;
   if(form.isConnected){
    controls.forEach(control=>{control.disabled=false;});
    if(button){button.disabled=false;button.textContent=buttonText;}
   }
  }
 });
 document.addEventListener("keydown",ev=>{
  if(ev.key==="Escape"){if(!$("#login-backdrop").hidden)closeLogin();else if(!$("#orders-backdrop").hidden)closeModal("#orders-backdrop");else if(!$("#checkout-backdrop").hidden)closeModal("#checkout-backdrop");else if(!$("#detail-backdrop").hidden)closeModal("#detail-backdrop");return;}
  if(ev.key==="/"&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)){ev.preventDefault();$("#event-search").focus();}
  if(ev.key!=="Tab")return;
  const panel=!$("#login-backdrop").hidden?$("#login-dialog"):!$("#orders-backdrop").hidden?$("#orders-dialog"):!$("#checkout-backdrop").hidden?$("#checkout-dialog"):!$("#detail-backdrop").hidden?$("#event-dialog"):null;if(!panel)return;
  const focusables=$$("button:not([disabled]),select,input,a[href]",panel).filter(el=>el.getClientRects().length);
  if(!focusables.length)return;
  if(ev.shiftKey&&document.activeElement===focusables[0]){ev.preventDefault();focusables.at(-1).focus();}
  else if(!ev.shiftKey&&document.activeElement===focusables.at(-1)){ev.preventDefault();focusables[0].focus();}
 });
 window.addEventListener("storage",ev=>{
  if(ev.key==="paselisto:commerce:demo:v1"){fetch("./data/eventos-clientes-demo.json").then(r=>r.json()).then(c=>{store=loadCommerce(c);filters();renderCards();renderFeatured();renderWeekStrip(realSamples,publishedEvents(store));}).catch(()=>{});}
 });
 // Event-page CTA returns to the existing authenticated demo checkout.
 // Reject unknown combinations instead of opening a checkout for a reference event.
 const params=new URLSearchParams(location.search);
 const checkoutEvent=params.get("checkout"),checkoutType=params.get("type");
 if(checkoutEvent && checkoutType && checkoutEvent.length<=160 && checkoutType.length<=100){
  const event=selectedEvent(checkoutEvent);
  if(event?.ticketTypes.some(t=>t.id===checkoutType)){
   history.replaceState(null,"",location.pathname+location.hash);
   openCheckout(checkoutEvent,checkoutType).catch(error=>console.error("PaseListo",error.message));
  }
 }
}
start();
