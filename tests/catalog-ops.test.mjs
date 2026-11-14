import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { seedCommerce } from '../src/commerce-domain.mjs';
import { publicReferenceEvents, catalogReconciliation, managementEventRows } from '../src/catalog-ops.mjs';
const fixture = path => readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const [sample, demo] = await Promise.all([
  fixture('../data/eventos-reales-referencia.json'),
  fixture('../data/eventos-clientes-demo.json')
]);
const today='2026-11-14';
test('dashboard public reference count exactly equals storefront visibility contract',()=>{
  const store=seedCommerce(demo);
  const visible=publicReferenceEvents(sample,today);
  const result=catalogReconciliation(store,sample,today);
  assert.deepEqual(result.publicIds,visible.map(x=>x.id));
  assert.equal(result.publicVisible,visible.length);
  assert.equal(result.referencesTotal, sample.events.length);
  assert.equal(result.demoTotal, demo.events.length);
  assert.equal(result.combinedTotal,result.referencesTotal+result.demoTotal);
  assert.equal(result.referencesNotInStore,result.referencesTotal-result.publicVisible);
  assert.ok(result.demoTotal>0 && result.referencesTotal>0);
});
test('expired and missing-media references never enter storefront counts',()=>{
  const fake={events:[
    {id:'expired',date:'2026-11-13',title:'Expired',posterUrl:'https://example.test/a.svg',description:'A long enough description with more than forty characters.'},
    {id:'missing',date:'2026-12-01',title:'No poster',description:'A long enough description with more than forty characters.'},
    {id:'short',date:'2026-12-01',title:'No description',posterUrl:'https://example.test/a.svg'},
    {id:'visible',date:'2026-12-01',title:'Visible',posterUrl:'https://example.test/a.svg',description:'A long enough description with more than forty characters.'}
  ]};
  const s=seedCommerce(demo);
  const x=catalogReconciliation(s,fake,today);
  assert.deepEqual(x.publicIds,['visible']);
  assert.equal(x.referencesArchived,1);
  assert.equal(x.referencesMissingMediaOrDescription,2);
  const rows=managementEventRows(s,fake,today);
  assert.equal(rows.find(y=>y.id==='expired').status,'ended');
  assert.equal(rows.find(y=>y.id==='missing').status,'incomplete');
  assert.equal(rows.find(y=>y.id==='visible').inStore,true);
  assert.equal(rows.find(y=>y.id==='visible').canManage,false);
});
test('internal demonstration events never become public offers',()=>{
  const s=seedCommerce(demo);
  const rows=managementEventRows(s,sample,today);
  const internal=rows.filter(r=>r.kind==='demo');
  assert.equal(internal.length,s.events.length);
  assert.ok(internal.every(r=>r.inStore===false && r.canManage===true));
  s.events[0].status='paused';
  assert.equal(managementEventRows(s,sample,today).find(r=>r.id===s.events[0].id).status,'paused');
});
test('public shop and control both use shared reference visibility import',async()=>{
  const [shop,control]=await Promise.all([
    readFile(new URL('../src/marketplace.mjs',import.meta.url),'utf8'),
    readFile(new URL('../src/control.mjs',import.meta.url),'utf8')
  ]);
  assert.match(shop,/publicReferenceEvents\(realSamples,current\(\)\)/);
  assert.match(control,/initOperationsDashboard/);
});
