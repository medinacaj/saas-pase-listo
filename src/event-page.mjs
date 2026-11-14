import { loadCommerce, quote } from "./commerce-domain.mjs";
import { forecastAvailable, daysUntilEvent, weatherDescription } from "./event-page-domain.mjs";
import { buildVenueZones, zoneBandPath, zoneBandLabelY } from "./venue-zones.mjs";
import { DEMO_REFERENCE_TIERS, referenceQuote, referenceOrderReceipt, referenceTicketLimit } from "./reference-checkout.mjs";
import { eventRequiresWaitingRoom } from "./waiting-room.mjs";
import { locateVenue, googleMapsEmbedUrl, googleMapsLocationUrl, googleMapsVenueSearchUrl } from "./venue-geolocation.mjs";


const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => (
 {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]
));
const clp = n => new Intl.NumberFormat("es-CL", {
 style:"currency",currency:"CLP",maximumFractionDigits:0
}).format(n);
const date = value => new Intl.DateTimeFormat("es-CL", {
 timeZone:"UTC",day:"numeric",month:"long",year:"numeric"
}).format(new Date(value+"T12:00:00Z"));
const todayInChile = () => new Intl.DateTimeFormat("sv-SE", {
 timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());
const setText = (selector,value) => { $(selector).textContent = value; };
const safePoster = value => {
 try {
  const url = new URL(value);
  return url.protocol === "https:" ? url.href : null;
 } catch { return null; }
};

function renderPoster(event,reference) {
 const color=/^#[a-f0-9]{6}$/i.test(event.accent||"")?event.accent:"#cff47a";
 const fallback='<div class="demo-poster-inner">'+
  '<span class="demo-art-top">'+(reference?(event.posterUrl?"AFICHE DE REFERENCIA":"FICHA INFORMATIVA · SIN VENTA"):"EVENTO DEMO · PASELISTO")+'</span>'+
  '<span class="demo-art-symbol" aria-hidden="true">✳</span>'+
  '<span class="demo-art-title">'+esc(event.title)+'</span>'+
  '<span class="demo-art-subtitle">'+esc(event.subtitle)+'</span>'+
  '<span class="demo-art-bottom">'+esc(event.city)+'</span></div>';
 const src=reference ? safePoster(event.posterUrl) :
  event.posterRights==="declarados_por_usuario_sin_verificar" ? safePoster(event.posterUrl) : null;
 const image=src?'<img class="poster-img '+(reference?"reference-poster":"owner-poster")+
   '" src="'+esc(src)+'" alt="Afiche de '+esc(event.title)+'" referrerpolicy="no-referrer">':"";
 $("#event-poster").innerHTML='<div class="poster-frame '+(reference?"real-poster":"demo-poster")+
  '" style="--poster-accent:'+color+'">'+fallback+image+'</div>';
 const img=$("#event-poster img");
 if(img) {
  const frame=img.closest(".poster-frame");
  img.addEventListener("load",()=>frame?.classList.add("loaded"),{once:true});
  img.addEventListener("error",()=>{frame?.classList.add("image-failed");img.remove();},{once:true});
  if(img.complete && img.naturalWidth>0)frame?.classList.add("loaded");
 }
}

function renderGeolocation(event,reference,registry) {
 const map=$("#venue-geolocation-map");
 const status=$("#venue-geolocation-status");
 const note=$("#venue-geolocation-note");
 const link=$("#venue-geolocation-link");
 const search=$("#venue-geolocation-search");
 map.replaceChildren();
 link.hidden=true;
 search.hidden=true;
 if(!reference) {
  status.textContent="Recinto ficticio";
  const message=document.createElement("p");
  message.className="venue-geolocation-unavailable";
  message.textContent="Este recinto pertenece a la demostración y no tiene una dirección real.";
  map.append(message);
  note.textContent="El plano de zonas que aparece más arriba es también ilustrativo.";
  return;
 }
 const venue=locateVenue(event,registry);
 if(!venue) {
  status.textContent="Ubicación no verificada";
  const message=document.createElement("p");
  message.className="venue-geolocation-unavailable";
  message.textContent="Todavía no tenemos coordenadas contrastadas de este recinto. No mostraremos un marcador aproximado.";
  map.append(message);
  note.textContent="Puedes comprobar el nombre del lugar mediante la búsqueda externa, pero confirma la dirección y accesos con el organizador.";
  search.href=googleMapsVenueSearchUrl(event);
  search.hidden=false;
  return;
 }
 status.textContent="Recinto localizado";
 const iframe=document.createElement("iframe");
 const publicMapsKey=document.querySelector('meta[name="google-maps-embed-key"]')?.content?.trim()||"";
 iframe.src=googleMapsEmbedUrl(venue,publicMapsKey);
 iframe.title="Mapa de "+event.venue+", "+event.city+", Chile";
 iframe.loading="lazy";
 iframe.referrerPolicy="strict-origin-when-cross-origin";
 iframe.setAttribute("aria-label","Google Maps con la ubicación del recinto");
 iframe.allowFullscreen=true;
 map.append(iframe);
 note.textContent=venue.note||"El marcador señala el recinto, no necesariamente la puerta de ingreso. Verifica los accesos antes de asistir.";
 link.href=googleMapsLocationUrl(venue);
 link.hidden=false;
}

function renderVenue(event,reference) {
 setText("#venue-description",
  "La función está anunciada para "+event.venue+" en "+event.city+
  ". Aquí puedes revisar el lugar y la ciudad sin salir de la ficha del espectáculo.");
 setText("#venue-location",event.venue+" · "+event.city+", Chile");
 // Optional venue facts come from the event catalog, never inferred from a city.
 // Unverified details must remain visibly pending.
 const optional = (field, fallback="Por confirmar") =>
  typeof field==="string" && field.trim() && field.length<=250 ? field.trim() : fallback;
 setText("#venue-address",optional(event.venueAddress));
 setText("#venue-doors",optional(event.doorsOpen));
 setText("#venue-accessibility",optional(event.accessibility));
 setText("#venue-transport",optional(event.transport));
 setText("#venue-age",optional(event.ageRestriction));
 setText("#venue-entry",optional(event.entryConditions));
 setText("#venue-note",reference
  ?"La dirección exacta, accesos, restricciones y horarios de apertura no están verificados por PaseListo."
  :"Este recinto es ficticio. La dirección, el estacionamiento y los accesos forman parte de una simulación.");
 setText("#event-conditions",reference
  ?"Esta ficha de un espectáculo real se usa exclusivamente para probar el recorrido de compra. Las zonas, tarifas y el pedido mostrado son ficticios; no hay contrato de venta, reservas ni entradas válidas."
  :"Este evento es completamente ficticio. Las categorías, los valores y las cantidades son de ensayo; no hay cobros, reservas reales ni entradas válidas.");
}

async function loadInventory() {
 try {
  const response=await fetch("./api/buyer/status",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)return {enabled:false};
  const status=await response.json();
  if(status.ready!==true||status.mode!=="local-demo")return {enabled:false};
  const stock=await fetch("./api/buyer/inventory",{cache:"no-store",credentials:"same-origin"});
  if(!stock.ok)throw Error("No se pudo validar el inventario");
  const data=await stock.json();
  if(!Array.isArray(data.events))throw Error("Inventario inválido");
  return {enabled:true,events:data.events};
 }catch(err){
  // With a functioning buyer API, missing stock must fail closed.
  if(err.message==="No se pudo validar el inventario"||err.message==="Inventario inválido")return {enabled:true,events:[]};
  return {enabled:false};
 }
}

function ticketSummary(event,type,store,inventory) {
 const stockEvent=inventory.enabled ? inventory.events.find(e=>e.eventId===event.id) : null;
 const remote=stockEvent?.ticketTypes?.find(t=>t.ticketTypeId===type.id);
 let base,fee,remaining;
 if(inventory.enabled){
  base=remote?.unitBaseClp;fee=remote?.feePerTicketClp;remaining=remote?.remaining;
  if(!Number.isSafeInteger(base)||!Number.isSafeInteger(fee)||!Number.isSafeInteger(remaining)){
   base=type.priceClp;fee=null;remaining=0;
  }
 }else{
  try{
   const pricing=quote(store,event.id,type.id,1,{availabilityRequired:false});
   base=pricing.unitBaseClp;fee=pricing.feePerTicketClp;
  }catch{
   base=type.priceClp;fee=null;
  }
 }
 const total=fee===null?null:base+fee;
 const canOrder=inventory.enabled&&Number.isSafeInteger(total)&&remaining>0;
 return {base,fee,remaining,total,canOrder};
}

let changeDemoTier=null;
function renderReferenceCheckout(event){
 const list=$("#event-ticket-list");
 const chooser=$("#reference-checkout");
 chooser.hidden=false;
 const tiers=DEMO_REFERENCE_TIERS;
 let selectedId=tiers[0].id;
 const quantity=$("#reference-ticket-quantity");
 const maxQuantity=referenceTicketLimit(event);
 quantity.replaceChildren();
 for(let n=1;n<=maxQuantity;n++){
  const option=document.createElement("option");
  option.value=String(n);option.textContent=n+" entrada"+(n===1?"":"s");
  quantity.append(option);
 }

 const step=$("#reference-checkout-step");
 const choose=$("#reference-checkout-select");
 const review=$("#reference-checkout-review");
 const complete=$("#reference-checkout-complete");
 const preview=$("#reference-checkout-preview");
 const summary=$("#reference-checkout-summary");
 const renderChoice=()=>{
  const quote=referenceQuote(event,selectedId,quantity.value);
  list.querySelectorAll("[data-reference-tier]").forEach(button=>{
   const active=button.dataset.referenceTier===selectedId;
   button.classList.toggle("is-selected",active);
   button.setAttribute("aria-pressed",String(active));
  });
  document.querySelectorAll("[data-zone-select]").forEach(button=>{
   const active=button.dataset.zoneSelect===selectedId;
   button.classList.toggle("is-selected",active);
   button.setAttribute("aria-pressed",String(active));
  });
  const selection=$("#venue-zone-selection");
  if(selection){selection.hidden=false;selection.textContent=quote.tierName+" · "+clp(quote.unitClp)+" por entrada · precio ficticio para ensayo";}
  preview.textContent="Subtotal ficticio: "+clp(quote.subtotalClp)+" · Cargo ficticio: "+clp(quote.serviceFeeClp)+" · Total DEMO: "+clp(quote.totalClp);
  return quote;
 };
 changeDemoTier=id=>{
  if(!tiers.some(tier=>tier.id===id))return;
  selectedId=id;
  renderChoice();
 };
 list.innerHTML=tiers.map((tier,index)=>
  '<button type="button" class="event-ticket-row reference-tier-option" data-reference-tier="'+
  esc(tier.id)+'" aria-pressed="'+(index===0)+'"><span class="event-ticket-top"><strong>'+esc(tier.name)+
  '</strong><strong>'+clp(tier.priceClp)+'</strong></span><small>Precio inventado para probar la compra; no es tarifa oficial</small></button>'
 ).join("");
 list.addEventListener("click",ev=>{
  const button=ev.target.closest("[data-reference-tier]");
  if(button)changeDemoTier(button.dataset.referenceTier);
 });
 quantity.addEventListener("change",renderChoice);
 $("#reference-checkout-next").addEventListener("click",()=>{
  const quote=renderChoice();
  step.textContent="PASO 2 DE 3 · RESUMEN";
  choose.hidden=true;review.hidden=false;complete.hidden=true;
  const rows=[
   ["Evento de referencia",event.title],["Categoría DEMO",quote.tierName],
   ["Cantidad",String(quote.quantity)],["Precio ficticio por entrada",clp(quote.unitClp)],
   ["Subtotal ficticio",clp(quote.subtotalClp)],["Cargo de servicio ficticio",clp(quote.serviceFeeClp)],
   ["Total de demostración",clp(quote.totalClp)]
  ];
  summary.replaceChildren();
  for(const [name,value] of rows){
   const row=document.createElement("div"),label=document.createElement("span"),amount=document.createElement("strong");
   label.textContent=name;amount.textContent=value;row.append(label,amount);summary.append(row);
  }
 });
 $("#reference-checkout-back").addEventListener("click",()=>{
  step.textContent="PASO 1 DE 3 · SELECCIÓN";
  choose.hidden=false;review.hidden=true;complete.hidden=true;
 });
 $("#reference-checkout-confirm").addEventListener("click",()=>{
  const quote=referenceQuote(event,selectedId,quantity.value);
  const receipt=referenceOrderReceipt(quote,crypto.randomUUID());
  review.hidden=true;choose.hidden=true;complete.hidden=false;
  step.textContent="PASO 3 DE 3 · FINALIZADO";
  complete.replaceChildren();
  const h=document.createElement("h3"),notice=document.createElement("p"),details=document.createElement("p"),restart=document.createElement("button");
  h.textContent="Simulación completada";
  notice.textContent="No se cobró dinero, no se hizo reserva y no se emitió entrada válida.";
  details.textContent="N.º de prueba: "+receipt.id+" · "+receipt.tierName+" · "+receipt.quantity+" entrada(s) · Total ficticio "+clp(receipt.totalClp);
  restart.type="button";restart.className="reference-checkout-secondary";restart.textContent="Realizar otra simulación";
  restart.addEventListener("click",()=>{
   choose.hidden=false;review.hidden=true;complete.hidden=true;
   step.textContent="PASO 1 DE 3 · SELECCIÓN";renderChoice();
  });
  complete.append(h,notice,details,restart);
 });
 renderChoice();
 setText("#ticket-disclaimer",
  "Máximo de "+maxQuantity+" boletos por persona en esta simulación. SIMULADOR: sectores, precios, cupos y cargos son ficticios. El organizador de este evento no vende entradas a través de PaseListo. No solicitamos datos bancarios ni personales.");
}

function renderTickets(event,store,reference,inventory) {
 const list=$("#event-ticket-list");
 if(reference){
  renderReferenceCheckout(event);
  return;
 }
 list.innerHTML=event.ticketTypes.map(type=>{
  const {base,fee,total,remaining,canOrder}=ticketSummary(event,type,store,inventory);
  const url="./index.html?checkout="+encodeURIComponent(event.id)+"&type="+encodeURIComponent(type.id);
  const action=canOrder
   ?'<a class="event-ticket-button" href="'+esc(url)+'">'+(eventRequiresWaitingRoom(event)?"Ingresar a lista de espera DEMO ↗":"Continuar pedido de prueba ↗")+'</a>'
   :'<button class="event-ticket-button" type="button" disabled>'+
     (inventory.enabled ? "No hay cupos de prueba" : "Compra demo solo en servidor local")+'</button>';
  return '<div class="event-ticket-row" data-ticket-zone="'+esc(type.id)+'"><div class="event-ticket-top"><div><strong>'+
    esc(type.name)+'</strong><small>'+(inventory.enabled
     ?esc(String(Math.max(0,remaining??0)))+' cupos de demostración'
     :"Categoría de ensayo")+'</small></div><strong class="event-ticket-total">'+
    (total===null?"Valor pendiente":clp(total))+'</strong></div>'+
    '<div class="event-ticket-breakdown"><span>Precio base</span><strong>'+clp(base)+'</strong>'+
    '<span>Cargo por servicio</span><strong>'+(fee===null?"Por confirmar":clp(fee))+'</strong>'+
    '<span>Total por entrada</span><strong>'+(total===null?"Por confirmar":clp(total))+'</strong></div>'+
    action+'</div>';
 }).join("");
 setText("#ticket-disclaimer",
  "Todos los valores son ficticios, en CLP y por entrada. No se realizan pagos reales. "+
  (eventRequiresWaitingRoom(event)?"Evento masivo: acceso con lista de espera y turno autorizado por el servidor de prueba. ":"")+
  (inventory.enabled?"Los cupos se verifican otra vez antes de registrar un pedido.":"Esta instalación no tiene habilitado un servidor de compras."));
}

function venueDiagram(zones,interactive=true){
 const stage='<rect x="220" y="26" width="240" height="66" rx="15" fill="#26342d"/>'+
  '<text x="340" y="66" text-anchor="middle" fill="#fff" font-size="19" font-weight="800" letter-spacing="3">ESCENARIO</text>';
 const backdrop='<rect x="38" y="10" width="604" height="388" rx="25" fill="#f5f6f0"/>'+
  '<path d="M85 367 Q340 321 595 367" fill="none" stroke="#d4dcd4" stroke-width="3" stroke-dasharray="7 9"/>';
 const bands=interactive
  ?zones.map((zone,index)=>{
    const label=zone.name.length>21?zone.name.slice(0,19)+"…":zone.name;
    return '<g class="venue-map-zone" data-zone-select="'+esc(zone.id)+'" tabindex="0" role="button" aria-pressed="false" aria-label="Seleccionar zona '+esc(zone.name)+'">'+
     '<path d="'+zoneBandPath(index,zones.length)+'" fill="'+zone.color+'" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>'+
     '<text x="340" y="'+zoneBandLabelY(index,zones.length)+'" class="venue-zone-svg-label" text-anchor="middle" dominant-baseline="middle" font-size="'+(zones.length>4?14:19)+'">'+esc(label)+'</text>'+
     '</g>';
   }).join("")
  :Array.from({length:3},(_,index)=>
   '<path d="'+zoneBandPath(index,3)+'" fill="'+(["#dee3dd","#cdd7cf","#e6e9e5"][index])+
   '" stroke="#fff" stroke-width="6"/>'
  ).join("")+
   '<text x="340" y="260" text-anchor="middle" fill="#5e6860" font-size="18" font-weight="800">SIN PLANO VERIFICADO</text>';
 return '<svg class="venue-diagram" viewBox="0 0 680 410" xmlns="http://www.w3.org/2000/svg" role="'+(interactive?"group":"img")+
  '" aria-label="'+(interactive?"Esquema interactivo de categorías de entradas":"Plano de sectores aún no disponible")+'">'+
  backdrop+stage+bands+
  '<text x="340" y="390" text-anchor="middle" fill="#718076" font-size="11" letter-spacing="2">ACCESO ILUSTRATIVO</text></svg>';
}

function renderVenueMap(event,store,reference,inventory){
 const map=$("#venue-zone-map"),legend=$("#venue-zone-legend");
 const selection=$("#venue-zone-selection");
 const disclaimer=$("#venue-map-accuracy");
 if(reference){
  const zones=buildVenueZones(DEMO_REFERENCE_TIERS);
  setText("#venue-map-intro","Explora una distribución ficticia y selecciona un sector para ensayar el proceso de compra.");
  map.innerHTML=venueDiagram(zones);
  legend.innerHTML=zones.map(zone=>
   '<button type="button" class="venue-zone-key" data-zone-select="'+esc(zone.id)+'" aria-pressed="false">'+
   '<span class="venue-zone-swatch" style="--zone-color:'+zone.color+'" aria-hidden="true"></span>'+
   '<span class="venue-zone-key-name">'+esc(zone.name)+'</span>'+
   '<strong class="venue-zone-key-price">'+clp(zone.priceClp)+'</strong></button>'
  ).join("");
  disclaimer.textContent="PLANO 100 % FICTICIO. No representa las zonas, butacas, precios ni disponibilidad del recinto real.";
  const panel=map.closest(".venue-map-panel");
  const onSelect=target=>{if(target?.dataset.zoneSelect)changeDemoTier?.(target.dataset.zoneSelect);};
  panel.addEventListener("click",ev=>onSelect(ev.target.closest("[data-zone-select]")));
  panel.addEventListener("keydown",ev=>{
   if(ev.key!=="Enter"&&ev.key!==" ")return;
   const target=ev.target.closest("g[data-zone-select]");
   if(target){ev.preventDefault();onSelect(target);}
  });
  selection.hidden=false;
  changeDemoTier?.(DEMO_REFERENCE_TIERS[0].id);
  return;
 }
 const zones=buildVenueZones(event.ticketTypes).map(zone=>{
  const type=event.ticketTypes.find(t=>t.id===zone.id);
  return {...zone,...ticketSummary(event,type,store,inventory)};
 });
 if(!zones.length){
  map.innerHTML="";
  legend.textContent="Este evento no tiene categorías de entrada para mostrar.";
  selection.hidden=true;
  disclaimer.textContent="";
  return;
 }
 setText("#venue-map-intro","Selecciona una zona del dibujo o de la leyenda para destacar su categoría y consultar el valor por entrada.");
 disclaimer.textContent="Plano ilustrativo DEMO: los colores diferencian tipos de entrada, no reproducen la distribución ni la posición real de asientos del recinto. Las zonas se ordenan por precio referencial.";
 map.innerHTML=venueDiagram(zones);
 legend.innerHTML=zones.map(zone=>
  '<button type="button" class="venue-zone-key" data-zone-select="'+esc(zone.id)+'" aria-pressed="false">'+
   '<span class="venue-zone-swatch" style="--zone-color:'+zone.color+'" aria-hidden="true"></span>'+
   '<span class="venue-zone-key-name">'+esc(zone.name)+'</span>'+
   '<strong class="venue-zone-key-price">'+(zone.total===null?"Valor pendiente":clp(zone.total))+'</strong>'+
  '</button>'
 ).join("");
 function selectZone(id){
  const zone=zones.find(item=>item.id===id);
  if(!zone)return;
  for(const node of [map,legend]){
   node.querySelectorAll("[data-zone-select]").forEach(control=>{
    const active=control.dataset.zoneSelect===id;
    control.classList.toggle("is-selected",active);
    control.setAttribute("aria-pressed",String(active));
   });
  }
  document.querySelectorAll("[data-ticket-zone]").forEach(row=>{
   row.classList.toggle("is-zone-selected",row.dataset.ticketZone===id);
  });
  selection.hidden=false;
  selection.textContent=zone.name+" · "+(zone.total===null?"Valor por confirmar":clp(zone.total)+" total por entrada")+
   (inventory.enabled&&Number.isSafeInteger(zone.remaining)?" · "+zone.remaining+" cupos de demostración":"")+
   ". Ver desglose en «Elige tu entrada».";
 }
 const panel=map.closest(".venue-map-panel");
 panel.addEventListener("click",ev=>{
  const target=ev.target.closest("[data-zone-select]");
  if(target)selectZone(target.dataset.zoneSelect);
 });
 panel.addEventListener("keydown",ev=>{
  if(ev.key!=="Enter"&&ev.key!==" ")return;
  const target=ev.target.closest("g[data-zone-select]");
  if(!target)return;
  ev.preventDefault();
  selectZone(target.dataset.zoneSelect);
 });
 selectZone(zones[0].id);
}

async function renderWeather(event) {
 const weather=$("#event-weather");
 const today=todayInChile(),days=daysUntilEvent(event.date,today);
 if(!Number.isFinite(days)||days<0){
  weather.textContent="La fecha del evento ya pasó; no se muestra un pronóstico histórico.";
  return;
 }
 if(!forecastAvailable(event.date,today,14)){
  weather.textContent="El pronóstico para "+event.city+
   " estará disponible aproximadamente 14 días antes del evento. No mostramos estimaciones meteorológicas con meses de antelación.";
  return;
 }
 weather.textContent="Consultando pronóstico para "+event.city+"…";
 try{
  const geoUrl=new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.search=new URLSearchParams({
   name:event.city,count:"5",language:"es",countryCode:"CL"
  }).toString();
  const geoResponse=await fetch(geoUrl,{signal:AbortSignal.timeout(8000)});
  if(!geoResponse.ok)throw Error("Ciudad no encontrada");
  const geo=await geoResponse.json();
  const place=geo.results?.find(p=>p.country_code==="CL" &&
   typeof p.latitude==="number" && typeof p.longitude==="number");
  if(!place)throw Error("No se encontró la ciudad");
  const forecastUrl=new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search=new URLSearchParams({
   latitude:String(place.latitude),longitude:String(place.longitude),
   timezone:"America/Santiago",forecast_days:"14",
   daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  }).toString();
  const response=await fetch(forecastUrl,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error("Pronóstico no disponible");
  const data=await response.json();
  const index=data.daily?.time?.indexOf(event.date)??-1;
  if(index<0)throw Error("No hay pronóstico para la fecha");
  const high=data.daily.temperature_2m_max[index];
  const low=data.daily.temperature_2m_min[index];
  const rain=data.daily.precipitation_probability_max?.[index];
  const code=data.daily.weather_code?.[index];
  if(!Number.isFinite(high)||!Number.isFinite(low))throw Error("Pronóstico incompleto");
  weather.innerHTML='<div class="event-weather-result"><div><strong>'+
   esc(weatherDescription(code))+'</strong><small>'+esc(event.city)+
   ' · '+esc(date(event.date))+'</small></div>'+
   '<div class="event-weather-temps"><strong>'+Math.round(high)+'° / '+Math.round(low)+'°C</strong>'+
   '<small>'+(Number.isFinite(rain)?"Prob. de precipitación "+Math.round(rain)+"%":"Precipitación no informada")+'</small></div></div>'+
   '<p class="event-weather-foot">Previsión aproximada a nivel de ciudad, no medición del recinto. Puede variar. Datos: <a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo</a>.</p>';
 }catch{
  weather.textContent="No es posible consultar el pronóstico de "+event.city+
   " en este momento. Vuelve a revisar cuando se acerque la fecha.";
 }
}

async function start() {
 const id=new URLSearchParams(location.search).get("id");
 if(!id || id.length>160){
  $("#event-page-status").textContent="No se ha indicado un evento. Vuelve a la cartelera para elegir uno.";
  return;
 }
 try{
  const [demoResponse,refsResponse,geoRegistry]=await Promise.all([
   fetch("./data/eventos-clientes-demo.json",{cache:"no-cache"}),
   fetch("./data/eventos-reales-referencia.json",{cache:"no-cache"}),
   fetch("./data/recintos-openstreetmap.json")
    .then(response=>response.ok?response.json():null).catch(()=>null)
  ]);
  if(!demoResponse.ok||!refsResponse.ok)throw Error("Catálogo no disponible");
  const catalog=await demoResponse.json(),refs=await refsResponse.json();
  const store=loadCommerce(catalog);

  const real=refs.events?.find(e=>e.id===id);
  const event=real||store.events.find(e=>e.id===id&&e.status==="published");
  if(!event){
   $("#event-page-status").textContent="No encontramos este evento en la cartelera. Puede no estar publicado o existir solo en otro navegador.";
   return;
  }
  const reference=Boolean(real);
  document.title=event.title+" · PaseListo";
  setText("#event-breadcrumb-name",event.title);
  setText("#event-category",event.category+" / "+event.city+(reference?" / REFERENCIA":" / DEMO"));
  setText("#event-title",event.title);
  setText("#event-subtitle",event.subtitle||"");
  setText("#event-description",event.description||"Evento ficticio de demostración.");
  const end=event.endDate&&event.endDate!==event.date?" al "+date(event.endDate):"";
  setText("#event-when",date(event.date)+end+(event.time?" · "+event.time+" h":" · horario por confirmar"));
  setText("#event-venue",event.venue);
  setText("#event-city",event.city+", Chile");
  setText("#event-organizer",reference?event.organizer:(store.organizers.find(o=>o.id===event.organizerId)?.name||"Organizador DEMO"));
  renderPoster(event,reference);
  renderVenue(event,reference);
  renderGeolocation(event,reference,geoRegistry);
  $("#event-page-status").hidden=true;
  $("#event-page-view").hidden=false;
  const inventory=reference?{enabled:false}:await loadInventory();
  renderTickets(event,store,reference,inventory);
  if(reference){
   setText("#tickets-heading","Elige tus entradas DEMO.");
   document.querySelector(".event-page-tickets .event-page-section-label").textContent="SIMULACIÓN · SIN VENTA REAL";
  }
  renderVenueMap(event,store,reference,inventory);
  await renderWeather(event);
 }catch{
  $("#event-page-status").hidden=false;
  $("#event-page-status").textContent="No pudimos cargar los detalles. Intenta recargar la página.";
 }
}
start();
