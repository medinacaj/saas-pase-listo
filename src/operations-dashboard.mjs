// Public, read-only operational views on *synthetic* browser data.
// No customer login, real providers, commercial inventory or database connection.
import { catalogReconciliation, managementEventRows } from './catalog-ops.mjs';
import { chileToday } from './week-events.mjs';

const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = x => new Intl.NumberFormat('es-CL').format(x);
const clp = x => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(x);
const q = id => document.getElementById(id);
const label = row => row.kind==='reference'?'Referencia sin contrato':'Evento interno DEMO';
const statusClass = row => row.status==='visible'?'on':row.status==='paused'||row.status==='incomplete'?'attention':'muted';
const source = () => 'Datos ficticios guardados en este navegador. No existe una base de datos de clientes conectada.';

// Exported to test filtering and grouping independently of the DOM.
export function operationsView(rows,{query='',type='all',status='all',sort='date'}={}) {
  const normal = x => String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const search=normal(query.trim().slice(0,120));
  const filtered=rows.filter(row=>
    (type==='all'||row.kind===type) &&
    (status==='all'||(status==='instore'?row.inStore:status==='offstore'?!row.inStore:row.status===status)) &&
    (!search||normal([row.title,row.company,row.city,row.venue,row.id,row.category].join(' ')).includes(search))
  );
  return [...filtered].sort((a,b)=>sort==='title'
    ?a.title.localeCompare(b.title,'es')
    :sort==='status'
    ?a.status.localeCompare(b.status)||a.date.localeCompare(b.date)
    :a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'es'));
}
function chip(row){return '<span class="ops-chip '+statusClass(row)+'">'+esc(row.statusLabel)+'</span>';}
function link(row){return row.kind==='reference'
  ?'<a href="./evento.html?id='+encodeURIComponent(row.id)+'" class="ops-go">Ver ficha</a>'
  :'<span class="ops-neutral">Solo interno</span>';}
function htmlRow(row,on){return '<tr><td><strong>'+esc(row.title)+'</strong><small>'+esc(label(row))+'</small></td>'+
  '<td>'+esc(row.company)+'</td><td>'+esc(row.city)+'<small>'+esc(row.date)+'</small></td>'+
  '<td>'+chip(row)+'</td><td>'+link(row)+'</td>'+
  '<td>'+(row.canManage?'<button class="ops-toggle" type="button" data-ops-toggle="'+esc(row.id)+'">'+(row.status==='paused'?'Reactivar':'Pausar')+' DEMO</button>':'—')+'</td></tr>';}
function renderRecords(rows,view){
  if(!rows.length)return '<div class="ops-empty">No hay eventos para estos filtros. Prueba otra búsqueda o estado.</div>';
  if(view==='cards')return '<div class="ops-cards">'+rows.map(row=>'<article class="ops-event-card"><div class="ops-event-meta"><span>'+esc(label(row))+'</span><span>'+esc(row.date)+'</span></div><h3>'+esc(row.title)+'</h3><p>'+esc(row.city)+' · '+esc(row.venue)+'</p><p>'+esc(row.company)+'</p><div class="ops-event-actions">'+chip(row)+link(row)+(row.canManage?'<button class="ops-toggle" type="button" data-ops-toggle="'+esc(row.id)+'">'+(row.status==='paused'?'Reactivar':'Pausar')+' DEMO</button>':'')+'</div></article>').join('')+'</div>';
  if(view==='calendar'){
    const months=new Map();
    rows.forEach(r=>{const key=r.date?.slice(0,7)||'Sin fecha';if(!months.has(key))months.set(key,[]);months.get(key).push(r);});
    return '<div class="ops-calendar">'+[...months].map(([month,items])=>'<section class="ops-month"><h3>'+esc(month)+' <small>'+items.length+' eventos</small></h3>'+
      items.map(r=>'<div class="ops-calendar-item"><time>'+esc(r.date)+'</time><div><strong>'+esc(r.title)+'</strong><small>'+esc(r.city)+' · '+esc(label(r))+'</small></div>'+chip(r)+'</div>').join('')+'</section>').join('')+'</div>';
  }
  return '<div class="table-overflow"><table class="ops-table"><thead><tr><th>Evento / origen</th><th>Empresa o productor</th><th>Ciudad / fecha</th><th>Estado</th><th>Ficha</th><th>Control DEMO</th></tr></thead><tbody>'+rows.map(htmlRow).join('')+'</tbody></table></div>';
}
function bars(pairs,color){
  const max=Math.max(1,...pairs.map(x=>x[1]));
  return '<div class="ops-bars">'+pairs.map(([key,n])=>'<div class="ops-bar-item"><div><strong>'+esc(key)+'</strong><span>'+fmt(n)+'</span></div><div class="ops-track" role="meter" aria-label="'+esc(key)+'" aria-valuemin="0" aria-valuemax="'+max+'" aria-valuenow="'+n+'"><span style="width:'+Math.round(n/max*100)+'%;background:'+color+'"></span></div></div>').join('')+'</div>';
}
function countBy(arr,key){const tally=new Map();for(const x of arr){const k=String(key(x)||'Otros');tally.set(k,(tally.get(k)||0)+1);}return [...tally].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'es'));}
function renderCharts(rows,store,reconcile){
  const publicRows=rows.filter(r=>r.inStore);
  const types=countBy(publicRows,r=>r.category);
  const status=countBy(rows,r=>r.statusLabel);
  const orders=store.orders||[];
  const simulated=orders.filter(o=>o.status==='demo_confirmed');
  const total=simulated.reduce((n,o)=>n+Number(o.pricing?.totalClp||0),0);
  q('ops-charts').innerHTML='<div class="ops-kpi-strip"><div><span>Eventos en tienda</span><strong>'+fmt(reconcile.publicVisible)+'</strong></div><div><span>Referencias históricas</span><strong>'+fmt(reconcile.referencesArchived)+'</strong></div><div><span>Pedidos DEMO</span><strong>'+fmt(simulated.length)+'</strong></div><div><span>Volumen simulado</span><strong>'+clp(total)+'</strong></div></div>'+
    '<div class="ops-chart-grid"><article class="panel"><h3>Categorías visibles en tienda</h3><p>Se cuentan exactamente las referencias que cumple el catálogo público.</p>'+bars(types.length?types:[['Sin eventos',0]],'#84aa65')+'</article>'+
    '<article class="panel"><h3>Distribución por estado</h3><p>Incluye referencias e inventario interno, claramente diferenciados.</p>'+bars(status,'#8ea7ba')+'</article></div>';
}
function renderClients(store) {
  const orders=store.orders||[];
  const fakeIds=new Map();
  for(const o of orders)if(typeof o.buyerId==='string'&&o.buyerId.length<=150){
    const row=fakeIds.get(o.buyerId)||{id:o.buyerId,orders:0,tickets:0};
    row.orders++;row.tickets+=Number(o.quantity||0);fakeIds.set(o.buyerId,row);
  }
  const customers=[...fakeIds.values()];
  q('ops-clients').innerHTML='<div class="ops-info-grid"><article><span>Compradores en simulación local</span><strong>'+fmt(customers.length)+'</strong><small>No son cuentas de compradores reales.</small></article><article><span>Clientes conectados a PostgreSQL</span><strong>Sin conexión</strong><small>Registro, permisos y protección de datos pendientes.</small></article></div>'+
    (customers.length?'<div class="table-overflow"><table><thead><tr><th>Identificador ficticio</th><th>Órdenes DEMO</th><th>Boletos DEMO</th><th>Origen</th></tr></thead><tbody>'+customers.map(c=>'<tr><td><code>'+esc(c.id)+'</code></td><td>'+fmt(c.orders)+'</td><td>'+fmt(c.tickets)+'</td><td>Este navegador</td></tr>').join('')+'</tbody></table></div>':
    '<div class="ops-empty">No hay compradores en esta simulación. No existe una base de clientes reales cargada.</div>');
}
function renderCompanies(store,rows){
  const fake=store.organizers||[];
  q('ops-companies').innerHTML='<p class="ops-subnote">Empresas ficticias del laboratorio; las referencias de terceros NO acreditan un contrato comercial.</p>'+
  '<div class="table-overflow"><table><thead><tr><th>Empresa</th><th>Eventos DEMO</th><th>Publicados internamente</th><th>Comisión teórica</th><th>Contrato</th></tr></thead><tbody>'+
    fake.map(o=>'<tr><td><strong>'+esc(o.name)+'</strong><small>'+esc(o.id)+'</small></td><td>'+fmt(rows.filter(r=>r.kind==='demo' && store.events.find(e=>e.id===r.id)?.organizerId===o.id).length)+'</td><td>'+fmt((store.events||[]).filter(e=>e.organizerId===o.id&&e.status==='published').length)+'</td><td>'+Number(o.venueShareBps||0)/100+'%</td><td><span class="ops-chip attention">Sin contrato real</span></td></tr>').join('')+'</tbody></table></div>';
}
const serviceTypes=[
  ['Pagos y conciliación','Sin proveedor autorizado','Bloquea cobros reales'],
  ['QR y control de acceso','Sin proveedor o infraestructura','Bloquea entradas válidas'],
  ['Correo transaccional','Sin proveedor configurado','Bloquea verificación de cuentas'],
  ['Seguridad y antiautomatización','Sin servicio integrado','Requiere configuración y auditoría'],
  ['Respaldo y observabilidad','Sin servicio operativo','Bloquea recuperación verificable']
];
function renderProviders(){
  q('ops-providers').innerHTML='<p class="ops-subnote">Registro de necesidades, no un directorio de proveedores contratados. Los servicios indicados NO están conectados.</p>'+
  '<div class="table-overflow"><table><thead><tr><th>Área de proveedor</th><th>Estado</th><th>Impacto</th></tr></thead><tbody>'+
  serviceTypes.map(r=>'<tr><td><strong>'+esc(r[0])+'</strong></td><td><span class="ops-chip attention">'+esc(r[1])+'</span></td><td>'+esc(r[2])+'</td></tr>').join('')+'</tbody></table></div>';
}
function renderDatabase(store,reconcile){
  const rows=[
    ['Catálogo de referencias',reconcile.referencesTotal,'Archivo JSON público','Solo lectura'],
    ['Organizadores y eventos ficticios',store.organizers.length+' / '+store.events.length,'localStorage de navegador','No compartido'],
    ['Órdenes de prueba',store.orders.length,'localStorage de navegador','Sin cobro'],
    ['Compradores y sesiones reales','0 conectados','API de compradores','No configurada'],
    ['Empresas y proveedores reales','0 conectados','Backend administrativo','No implementado'],
    ['Backups productivos','No verificado','Infraestructura','Pendiente']
  ];
  q('ops-database').innerHTML='<p class="ops-subnote">Estado de las fuentes de datos de ESTE panel. No se consulta PostgreSQL ni se simula una conexión exitosa.</p>'+
  '<div class="table-overflow"><table><thead><tr><th>Entidad</th><th>Registros / estado</th><th>Origen</th><th>Sincronización</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r[0])+'</strong></td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td><td>'+esc(r[3])+'</td></tr>').join('')+'</tbody></table></div>'+
  '<div class="ops-next"><strong>Para conectar una base de datos real</strong><p>Es necesario autenticar operadores y aplicar autorización por empresa, migraciones versionadas, respaldos y pruebas de aislamiento. No ingreses información de clientes en esta demostración pública.</p></div>';
}

export function initOperationsDashboard(getData, onToggleDemo) {
  const options={query:'',type:'all',status:'all',sort:'date',view:'table'};
  function render(){
    const {store,references}=getData();
    if(!store||!references)return;
    const today=chileToday();
    const reconciled=catalogReconciliation(store,references,today);
    const rows=managementEventRows(store,references,today);
    const visible=operationsView(rows,options);
    q('ops-reconciliation').innerHTML=[
      ['Visibles en la tienda',reconciled.publicVisible,'Misma cifra que el portal, sin filtros'],
      ['Referencias completas',reconciled.referencesTotal,'Incluye antiguas y sin ficha pública'],
      ['Referencias vencidas',reconciled.referencesArchived,'No se ofrecen en cartelera'],
      ['Demo internas',reconciled.demoTotal,'No se publican como venta real'],
      ['Pausadas DEMO',reconciled.demoPaused,'Control local de estado']
    ].map(([name,count,note])=>'<article><span>'+esc(name)+'</span><strong>'+fmt(count)+'</strong><small>'+esc(note)+'</small></article>').join('');
    q('ops-list-count').textContent=fmt(visible.length)+' de '+fmt(rows.length)+' registros';
    q('ops-view').innerHTML=renderRecords(visible,options.view);
    q('ops-view-buttons').querySelectorAll('[data-ops-view]').forEach(b=>{
      const active=b.dataset.opsView===options.view;b.setAttribute('aria-pressed',String(active));b.classList.toggle('active',active);
    });
    renderCharts(rows,store,reconciled);
    renderClients(store);renderCompanies(store,rows);renderProviders();renderDatabase(store,reconciled);
  }
  q('ops-search').addEventListener('input',e=>{options.query=e.target.value;render();});
  for(const [id,key] of [['ops-type','type'],['ops-status','status'],['ops-sort','sort']])
    q(id).addEventListener('change',e=>{options[key]=e.target.value;render();});
  q('ops-view-buttons').addEventListener('click',e=>{
    const el=e.target.closest('[data-ops-view]');if(!el)return;
    options.view=el.dataset.opsView;render();
  });
  q('ops-view').addEventListener('click',e=>{
    const button=e.target.closest('[data-ops-toggle]');
    if(!button)return;
    if(typeof onToggleDemo==='function')onToggleDemo(button.dataset.opsToggle);
  });
  render();
  return render;
}
