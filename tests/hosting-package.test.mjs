import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dest=join(root,'dist');
const build=join(root,'scripts/build-hosting-demo.mjs');

test('hosting package contains only public demo files and no backend',async()=>{
  const log=execFileSync(process.execPath,[build],{cwd:root,encoding:'utf8',timeout:20000});
  assert.match(log,/paquete estático DEMO/);
  for(const path of ['index.html','evento.html','admin.html','src/marketplace.mjs',
    'src/checkout-state.mjs','src/reference-checkout.mjs','favicon.svg','robots.txt']){
    assert.ok((await lstat(join(dest,path))).isFile(),path);
  }
  for(const forbidden of ['server','db','tests','.github','.local','package.json','README.md']){
    await assert.rejects(lstat(join(dest,forbidden)),{code:'ENOENT'});
  }
  const robot=await readFile(join(dest,'robots.txt'),'utf8');
  assert.match(robot,/Disallow: \//);
  const homepage=await readFile(join(dest,'index.html'),'utf8');
  assert.match(homepage,/name="robots" content="noindex,nofollow"/);
  const assets=await readdir(join(dest,'assets/event-art'));
  assert.ok(assets.length>=8,'missing event artwork for the demo');
});
