import { loadCommerce, saveCommerce, clearCommerce, organizerEvents, ordersForOrganizer, statsForOrganizer, createOrganizerEvent, cancelSimulatedOrder, quote, available } from "./commerce-domain.mjs";
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const money=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
let catalog,store,orgId;
const name=id=>store.organizers.find(o=>o.id===id)?.name||"Organizador DEMO";
function render(){
 const stats=statsForOrganizer(store,orgId);
 $("#kpi").innerHTML=[
 ["Eventos publicados",stats.events,"De esta productora"],
 ["Pedidos de prueba",stats.orders,"Simulaciones registradas"],
 ["Entradas simuladas",stats.ticketsSimulated,"No son válidas"],
 ["Volumen teórico",money(stats.grossClp),"Sin dinero recibido"]
 ].map(([label,value,note])=>'<article><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></article>').join("");
 const events=organizerEvents(store,orgId);
 $("#organizer-events").innerHTML=events.length?events.map(e=>{
 const qty=e.ticketTypes.reduce((sum,t)=>sum+(t.capacity-available(store,e.id,t.id)),0);
 return '<article class="event-line"><div class="event-square" style="background:'+(/^#[0-9a-f]{6}$/i.test(e.accent)?e.accent:"#CFF47A")+'">✳</div><div><strong>'+esc(e.title)+'</strong><span>'+esc(e.city)+' · '+esc(e.date)+' · '+esc(e.venue)+'</span><small>'+esc(e.ticketTypes.map(t=>t.name+" "+money(t.priceClp)).join(" · "))+'</small></div><div class="status"><b>Publicado DEMO</b><small>'+qty+' entradas simuladas</small></div></article>';
 }).join(""):'<p class="empty">Sin eventos de prueba para esta organización.</p>';
 const orders=ordersForOrganizer(store,orgId);
 $("#orders-view").innerHTML=orders.length?'<div class="table-scroll"><table><thead><tr><th>N.º</th><th>Evento</th><th>Unidades</th><th>Precio base</th><th>Cargo servicio</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>'+orders.map(o=>{
 const e=store.events.find(e=>e.id===o.eventId);
 return '<tr><td><code>'+esc(o.id)+'</code></td><td>'+esc(e?.title||"Evento")+'</td><td>'+o.quantity+'</td><td>'+money(o.pricing.faceValueClp)+'</td><td>'+money(o.pricing.serviceFeeClp)+'</td><td>'+money(o.pricing.totalClp)+'</td><td>'+esc(o.status==="demo_confirmed"?"Simulada":"Anulada DEMO")+'</td><td>'+(o.status==="demo_confirmed"?'<button type="button" data-cancel-order="'+esc(o.id)+'">Anular DEMO</button>':"—")+'</td></tr>';
 }).join("")+'</tbody></table></div>':'<p class="empty">Todavía no hay pedidos simulados para esta empresa. Prueba la selección de entradas desde <a href="./index.html#cartelera">el portal público</a>.</p>';
 const owner=store.organizers.find(o=>o.id===orgId);
 const q=events.length?quoteSafe(events[0]):null;
 const base=q?.unitBaseClp??15000;
 const fee=Math.round(base*store.contract.buyerFeeBps/10000)+store.contract.buyerFeeFixedClp;
 const share=Math.round(fee*(owner?.venueShareBps??0)/10000);
 $("#fee-example").innerHTML='<strong>Ejemplo de acuerdo B2B · 1 entrada</strong><div><span>Precio base fijado por el organizador</span><b>'+money(base)+'</b></div><div><span>Cargo de servicio del comprador</span><b>'+money(fee)+'</b></div><div class="total"><span>Precio final publicado</span><b>'+money(base+fee)+'</b></div><div><span>Participación del recinto en el cargo (ejemplo)</span><b>'+money(share)+'</b></div><div><span>Ingreso bruto del cargo para PaseListo (antes de costos/impuestos)</span><b>'+money(fee-share)+'</b></div>';
}
function quoteSafe(e){try{return quote(store,e.id,e.ticketTypes[0].id,1);}catch{return null;}}
async function boot(){
 try{const r=await fetch("./data/eventos-clientes-demo.json",{cache:"no-cache"});if(!r.ok)throw Error("Catálogo no disponible");catalog=await r.json();store=loadCommerce(catalog);orgId=store.organizers[0].id;
 $("#organization").innerHTML=store.organizers.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join("");render();
 }catch(err){$("#organizer-events").innerHTML='<p>Fallo al cargar demo: '+esc(err.message)+'</p>';return;}
 $("#organization").addEventListener("change",e=>{orgId=e.target.value;render();});
 $("#reset").addEventListener("click",()=>{if(!confirm("¿Borrar todos los eventos y pedidos ficticios guardados en este navegador?"))return;clearCommerce();store=loadCommerce(catalog);orgId=store.organizers[0].id;$("#organization").value=orgId;render();$("#form-feedback").textContent="Datos demostrativos restablecidos.";});
 $("#new-event").addEventListener("submit",e=>{
  e.preventDefault();const feedback=$("#form-feedback");feedback.textContent="";
  const data=Object.fromEntries(new FormData(e.target).entries());
  data.priceClp=Number(data.priceClp);data.capacity=Number(data.capacity);data.posterRightsConfirmed=Boolean(e.target.elements.posterRightsConfirmed.checked);
  try{const event=createOrganizerEvent(store,orgId,data);saveCommerce(store);e.target.reset();render();feedback.textContent="Evento "+event.title+" publicado en tu catálogo DEMO. Puedes verlo en la tienda pública desde este mismo navegador.";feedback.className="form-feedback success";}
  catch(err){feedback.textContent=err.message;feedback.className="form-feedback error";}
 });
 $("#orders-view").addEventListener("click",e=>{const b=e.target.closest("[data-cancel-order]");if(!b)return;if(!confirm("¿Anular esta compra ficticia?"))return;try{cancelSimulatedOrder(store,orgId,b.dataset.cancelOrder);saveCommerce(store);render();}catch(err){alert(err.message);}});
 window.addEventListener("storage",e=>{if(e.key!=="paselisto:commerce:demo:v1")return;store=loadCommerce(catalog);render();});
}
boot();