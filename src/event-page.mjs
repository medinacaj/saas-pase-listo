import { loadCommerce, quote } from "./commerce-domain.mjs";
import { forecastAvailable, daysUntilEvent, weatherDescription } from "./event-page-domain.mjs";
import { buildVenueZones, zoneBandPath, zoneBandLabelY } from "./venue-zones.mjs";
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
  ?"La información de este espectáculo se utiliza como referencia visual. PaseListo no ha acreditado un contrato de venta con el organizador, ni precios, aforo o condiciones de ingreso. No se emiten entradas desde esta página."
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

function renderTickets(event,store,reference,inventory) {
 const list=$("#event-ticket-list");
 if(reference){
  list.innerHTML='<div class="event-no-prices"><strong>Precios no disponibles en PaseListo.</strong>'+
   'No publicamos valores de terceros sin acuerdo comercial ni inventario verificado. Este espectáculo es solo una referencia.</div>';
  setText("#ticket-disclaimer","Sin botones de compra, tarifas supuestas ni enlaces de venta de terceros.");
  return;
 }
 list.innerHTML=event.ticketTypes.map(type=>{
  const {base,fee,total,remaining,canOrder}=ticketSummary(event,type,store,inventory);
  const url="./index.html?checkout="+encodeURIComponent(event.id)+"&type="+encodeURIComponent(type.id);
  const action=canOrder
   ?'<a class="event-ticket-button" href="'+esc(url)+'">Continuar pedido de prueba ↗</a>'
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
  (inventory.enabled?"Los cupos se verifican otra vez antes de registrar un pedido.":"GitHub Pages no dispone de servidor de compras."));
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
  setText("#venue-map-intro","Las zonas y categorías oficiales de este recinto no están acreditadas en PaseListo.");
  map.innerHTML=venueDiagram([],false);
  legend.innerHTML='<p class="venue-map-empty">Mapa de sectores pendiente de verificación con el organizador. No se asignan ubicaciones ni precios de terceros.</p>';
  selection.hidden=true;
  disclaimer.textContent="Gráfico neutro de espera: no representa el plano real del recinto.";
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
  setText("#event-description",reference
   ?"Una ficha del espectáculo para consultar fecha, ciudad y recinto en un solo lugar. Esta referencia no representa una oferta de venta de PaseListo."
   :event.description||"Evento ficticio de demostración.");
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
  renderVenueMap(event,store,reference,inventory);
  await renderWeather(event);
 }catch{
  $("#event-page-status").hidden=false;
  $("#event-page-status").textContent="No pudimos cargar los detalles. Intenta recargar la página.";
 }
}
start();
