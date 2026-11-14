import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { operationsView } from '../src/operations-dashboard.mjs';
import { catalogReconciliation, managementEventRows, publicReferenceEvents } from '../src/catalog-ops.mjs';
import { seedCommerce } from '../src/commerce-domain.mjs';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const [demo,references]=await Promise.all([
  read('../data/eventos-clientes-demo.json').then(JSON.parse),
  read('../data/eventos-reales-referencia.json').then(JSON.parse)
]);
const today='2026-11-14';
test('all management views share the same complete event records',()=>{
  const store=seedCommerce(demo);
  const records=managementEventRows(store,references,today);
  const stats=catalogReconciliation(store,references,today);
  assert.equal(records.length,stats.combinedTotal);
  assert.equal(records.filter(x=>x.inStore).length,publicReferenceEvents(references,today).length);
  assert.equal(records.filter(x=>x.inStore).length,stats.publicVisible);
  assert.equal(operationsView(records).length,records.length);
  assert.equal(operationsView(records,{status:'instore'}).length,stats.publicVisible);
  assert.equal(operationsView(records,{type:'demo'}).length,stats.demoTotal);
  assert.equal(operationsView(records,{type:'reference'}).length,stats.referencesTotal);
  assert.equal(operationsView(records,{status:'offstore'}).length,stats.combinedTotal-stats.publicVisible);
});
test('search, order, status filters do not mutate or expose references as sellable',()=>{
  const store=seedCommerce(demo),rows=managementEventRows(store,references,today);
  const original=structuredClone(rows);
  assert.ok(operationsView(rows,{query:'santiago'}).every(r=>
    [r.title,r.company,r.city,r.venue,r.id,r.category].join(' ').normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('santiago')));
  assert.ok(operationsView(rows,{sort:'title'}).every((r,i,a)=>i===0||a[i-1].title.localeCompare(r.title,'es')<=0));
  assert.equal(operationsView(rows,{type:'reference'}).some(r=>r.canManage),false);
  assert.deepEqual(rows,original);
});
test('admin navigation offers all modules and table/cards/calendar',async()=>{
 const [html,js,css,control,market]=await Promise.all([
  read('../admin.html'),read('../src/operations-dashboard.mjs'),read('../src/operations.css'),
  read('../src/control.mjs'),read('../src/marketplace.mjs')
 ]);
 for(const key of ['inventario','analitica','clientes','empresas','proveedores','datos','ops-view','ops-search','ops-status','ops-type','ops-sort'])
   assert.ok(html.includes('id="'+key+'"'),key);
 for(const kind of ['table','cards','calendar'])assert.ok(html.includes('data-ops-view="'+kind+'"'),kind);
 assert.match(control,/document\.querySelectorAll\("\.ref-art img"\)\.forEach/);
 assert.doesNotMatch(control,/\$\("\.ref-art img"\)\.forEach/);
 assert.match(market,/publicReferenceEvents\(realSamples,current\(\)\)/);
 assert.match(js,/Sin conexión|Sin PostgreSQL conectado|no existe una base de datos|No existe una base de datos/i);
 assert.ok(css.includes('.ops-cards'));
});
