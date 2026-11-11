import {loadCommerce, saveCommerce, clearCommerce} from "./commerce-domain.mjs";
import {ownerOverview,ownerEvents,ownerOrders,ownerRegisterPartner,ownerPublishEvent,ownerSetEventState,ownerSetFeePolicy,ownerSetShare,ownerCancelDemo,ownerReferenceCatalog} from "./control-domain.mjs";
const $=(s,root=document)=>root.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
const safeUrl=u=>{try{const url=new URL(u);return url.protocol==="https:"?url.href:"";}catch{return""}};
const error=(target,msg)=>{const el=$(target);if(el){el.textContent=msg;el.classList.add("feedback","error");}};
const success=(target,msg)=>{const el=$(target);if(el){el.textContent=msg;el.classList.remove("error");el.classList.add("feedback");}};
let catalog,refCatalog,store;
function remember(){saveCommerce(store);render();}
function setOrgSelect(){
 const select=$("#event-org"),value=select.value;
 select.innerHTML=store.organizers.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join("");
 if(store.organizers.some(o=>o.id===value))select.value=value;
}
function renderOverview(){
 const v=ownerOverview(store);
 const entries=[
 ["Productores y recintos",v.organizers,"Organizaciones sintéticas"],
 ["Eventos en catálogo",v.activeEvents,"Publicados en la tienda DEMO"],
 ["Entradas simuladas",v.tickets,"Órdenes sin pago ni emisión"],
 ["Volumen total DEMO",money(v.grossClp),"No representa ingresos percibidos"]
 ];
 $("#metrics").innerHTML=entries.map(([label,value,hint])=>'<article><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(hint)+'</small></article>').join("");
 $("#money-breakdown").innerHTML='<div class="breakdown">'+[
 ["Valor base de los eventos",v.faceValueClp],
 ["Cargo por servicio teórico",v.serviceFeeClp],
 ["Participación de recintos",v.venueShareClp],
 ["Cargo bruto que retendría PaseListo",v.platformGrossFeeClp],
 ["Volumen del comprador (sin pago)",v.grossClp]
 ].map(([label,n],i)=>'<div class="'+(i===4?"total":"")+'"><span>'+esc(label)+'</span><strong>'+money(n)+'</strong></div>').join("")+'</div>';
 const recent=store.audit.slice(0,8);
 $("#activity-feed").innerHTML=recent.length?recent.map(a=>'<div class="activity-item"><span>'+esc(a.action)+'</span><small>'+esc(new Date(a.at).toLocaleDateString("es-CL"))+'</small></div>').join(""):'<p class="helper">Sin acciones todavía. Publica eventos de prueba desde el control central.</p>';
 const settlement=[
 ["Valor base de entradas activas",v.faceValueClp],
 ["Total de cargos de servicio",v.serviceFeeClp],
 ["Participación teórica del recinto",v.venueShareClp],
 ["Cargo de servicio restante en PaseListo",v.platformGrossFeeClp]
 ];
 $("#settlement-summary").innerHTML=settlement.map(([k,num])=>'<div class="settle-row"><span>'+esc(k)+'</span><strong>'+money(num)+'</strong></div>').join("");
 $("#fee-form").elements.percent.value=Number(store.contract.buyerFeeBps)/100;
 $("#fee-form").elements.fixed.value=Number(store.contract.buyerFeeFixedClp);
}
function renderEvents(){
 const rows=ownerEvents(store);
 $("#events-body").innerHTML=rows.length?rows.map(e=>
 '<tr><td><strong>'+esc(e.title)+'</strong><small>'+esc(e.venue)+'</small><small class="internal-event-id">ID interno: <code>'+esc(e.id)+'</code></small></td>'+
 '<td>'+esc(e.organizerName)+'</td>'+
 '<td>'+esc(e.city)+'<small>'+esc(e.date)+'</small></td>'+
 '<td>'+e.issuedDemo+' / '+e.ticketTypes.reduce((n,t)=>n+t.capacity,0)+'<small>Máx. '+(e.maxTicketsPerPerson??10)+' por persona</small></td>'+
 '<td><span class="status '+(e.status==="paused"?"paused":"")+'">'+(e.status==="published"?"Publicación DEMO":"Pausado DEMO")+'</span></td>'+
 '<td><button type="button" class="action-btn '+(e.status==="published"?"danger":"")+'" data-toggle-event="'+esc(e.id)+'">'+(e.status==="published"?"Pausar":"Reactivar")+'</button></td></tr>').join(""):'<tr><td colspan="6" class="empty">No existen eventos ficticios.</td></tr>';
}
function renderOrders(){
 const orders=ownerOrders(store);
 $("#orders-body").innerHTML=orders.length?orders.map(o=>
 '<tr><td><code>'+esc(o.id)+'</code></td><td>'+esc(o.eventTitle)+'</td><td>'+esc(o.organizerName)+'</td>'+
 '<td>'+o.quantity+'</td><td>'+money(o.pricing.faceValueClp)+'</td><td>'+money(o.pricing.serviceFeeClp)+'</td><td>'+money(o.pricing.totalClp)+'</td>'+
 '<td><span class="status '+(o.status==="demo_cancelled"?"cancelled":"")+'">'+(o.status==="demo_confirmed"?"Simulado":"Anulado")+'</span></td>'+
 '<td>'+(o.status==="demo_confirmed"?'<button type="button" class="action-btn danger" data-cancel-order="'+esc(o.id)+'">Anular DEMO</button>':"—")+'</td></tr>').join(""):'<tr><td colspan="9" class="empty">No hay compras simuladas. Prueba el checkout en la tienda pública.</td></tr>';
}
function renderPartners(){
 $("#partners-body").innerHTML=store.organizers.map(p=>{
  const events=store.events.filter(e=>e.organizerId===p.id).length;
  const orders=store.orders.filter(o=>o.organizerId===p.id&&o.status==="demo_confirmed").length;
  return '<tr><td>'+esc(p.name)+'</td><td>'+events+'</td><td>'+orders+'</td><td>'+Number(p.venueShareBps)/100+'% del cargo de servicio</td>'+
  '<td><span class="status paused">DEMO · sin contrato</span></td>'+
  '<td><form data-share-form="'+esc(p.id)+'" class="compact-form" style="grid-template-columns:90px auto;gap:8px;margin:0"><label><span class="vis-label">Participación (%)</span><input type="number" min="0" max="100" step="1" name="percent" value="'+Number(p.venueShareBps)/100+'" required></label><button type="submit" class="action-btn">Guardar</button></form></td></tr>';
 }).join("");
 setOrgSelect();
}
function renderReferences(){
 const items=ownerReferenceCatalog(refCatalog);
 const now=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 $("#references-grid").innerHTML=items.filter(e=>(e.endDate||e.date)>=now).map(e=>{
  const url=safeUrl(e.posterUrl);
  const tone=/^#[a-f0-9]{6}$/i.test(e.accent)?e.accent:"#d7efb8";
  const img=url?'<img src="'+esc(url)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="Afiche promocional real: '+esc(e.title)+'">':'';
  return '<article class="reference-card"><div class="ref-art" style="--tone:'+tone+'"><div class="no-poster">'+esc(e.title)+'</div>'+img+'</div>'+
  '<div class="reference-info"><span class="status reference">EJEMPLO · NO A LA VENTA</span><p><strong>'+esc(e.title)+'</strong></p><small class="internal-event-id">ID interno: <code>'+esc(e.id)+'</code></small><p>'+esc(e.venue)+' · '+esc(e.city)+'<br>'+esc(e.date)+'</p>'+
  '<small>'+esc(e.posterCredit)+' · derechos comerciales no acreditados</small>'+
  '</div></article>';
 }).join("");
}
function render(){
 renderOverview();renderEvents();renderOrders();renderPartners();renderReferences();
 $(".ref-art img").forEach(img=>img.addEventListener("error",()=>img.remove(),{once:true}));
}

async function initialize(){
 try{
  const [a,b]=await Promise.all([fetch("./data/eventos-clientes-demo.json",{cache:"no-cache"}),fetch("./data/eventos-reales-referencia.json",{cache:"no-cache"})]);
  if(!a.ok||!b.ok)throw Error("Falta cargar datos DEMO");
  catalog=await a.json();refCatalog=await b.json();store=loadCommerce(catalog);
  render();
 }catch(err){
  $("#events-body").innerHTML='<tr><td colspan="6">No se pudo cargar el centro de control: '+esc(err.message)+'</td></tr>';return;
 }
 $("#reset-demo").addEventListener("click",()=>{
  if(!confirm("¿Borrar todos los datos ficticios guardados en este navegador y restablecer la demo?"))return;
  clearCommerce();store=loadCommerce(catalog);render();success("#event-feedback","Demostración restablecida.");
 });
 $("#event-form").addEventListener("submit",ev=>{
  ev.preventDefault();
  const form=ev.target;
  const data=Object.fromEntries(new FormData(form).entries());
  const organizerId=data.organizerId;delete data.organizerId;
  data.capacity=Number(data.capacity);data.priceClp=Number(data.priceClp);data.maxTicketsPerPerson=Number(data.maxTicketsPerPerson);
  try{
   const e=ownerPublishEvent(store,organizerId,data);remember();form.reset();success("#event-feedback","Evento "+e.title+" creado. Visible en la tienda de demostración de este navegador.");
  }catch(err){error("#event-feedback",err.message);}
 });
 $("#event-org").addEventListener("change",()=>{});
 $("#events-body").addEventListener("click",ev=>{
  const btn=ev.target.closest("[data-toggle-event]");if(!btn)return;
  try{
   const e=store.events.find(e=>e.id===btn.dataset.toggleEvent);
   ownerSetEventState(store,e.id,e.status==="published"?"paused":"published");remember();
  }catch(err){alert(err.message);}
 });
 $("#orders-body").addEventListener("click",ev=>{
  const btn=ev.target.closest("[data-cancel-order]");if(!btn)return;
  if(!confirm("¿Anular este pedido ficticio y liberar los cupos de prueba?"))return;
  try{ownerCancelDemo(store,btn.dataset.cancelOrder);remember();}catch(err){alert(err.message);}
 });
 $("#partner-form").addEventListener("submit",ev=>{
  ev.preventDefault();const data=new FormData(ev.target);
  try{
   ownerRegisterPartner(store,{name:data.get("name"),shareBps:Number(data.get("sharePercent"))*100});
   remember();ev.target.reset();success("#partner-feedback","Vínculo B2B ficticio añadido. No se creó cuenta real ni contrato.");
  }catch(err){error("#partner-feedback",err.message);}
 });
 $("#partners-body").addEventListener("submit",ev=>{
  if(!ev.target.matches("[data-share-form]"))return;
  ev.preventDefault();const data=new FormData(ev.target);
  try{ownerSetShare(store,ev.target.dataset.shareForm,Number(data.get("percent"))*100);remember();}
  catch(err){alert(err.message);}
 });
 $("#fee-form").addEventListener("submit",ev=>{
  ev.preventDefault();const data=new FormData(ev.target);
  try{ownerSetFeePolicy(store,Number(data.get("percent"))*100,Number(data.get("fixed")));remember();success("#fee-feedback","Tarifa de prueba modificada. No afecta pedidos anteriores.");}
  catch(err){error("#fee-feedback",err.message);}
 });
 window.addEventListener("storage",ev=>{
  if(ev.key==="paselisto:commerce:demo:v1"){store=loadCommerce(catalog);render();}
 });
 const links=[...document.querySelectorAll(".sidebar nav a")];
 const sections=links.map(a=>document.querySelector(a.getAttribute("href"))).filter(Boolean);
 if("IntersectionObserver" in window){
  const io=new IntersectionObserver(items=>items.forEach(entry=>{
   if(entry.isIntersecting){links.forEach(a=>a.classList.toggle("nav-current",a.hash==="#"+entry.target.id));}
  }),{rootMargin:"-15% 0px -72% 0px",threshold:0});
  sections.forEach(s=>io.observe(s));
 }
}
initialize();