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

test('all local HTML styles, scripts and module imports resolve in the package',async()=>{
  const { stat }=await import('node:fs/promises');
  const { dirname, resolve:resolvePath, sep }=await import('node:path');
  const pages=['index.html','evento.html','admin.html','organizador.html','laboratorio.html'];
  const modules=async(dirnamePath)=>{
    let list=[];
    for(const entry of await readdir(dirnamePath,{withFileTypes:true})){
      const full=join(dirnamePath,entry.name);
      if(entry.isDirectory())list.push(...await modules(full));
      else if(entry.name.endsWith('.mjs'))list.push(full);
    }
    return list;
  };
  const files=[...pages.map(p=>join(dest,p)),...await modules(join(dest,'src'))];
  for(const file of files){
    const content=await readFile(file,'utf8');
    const refs=file.endsWith('.html')?
      [...content.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(x=>x[1]):
      [...content.matchAll(/\b(?:from|import)\s*["']([^"']+)["']/g)].map(x=>x[1])
        .concat([...content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(x=>x[1]));
    for(const ref of refs){
      if(!ref.startsWith('./')&&!ref.startsWith('../'))continue;
      const path=decodeURIComponent(ref.split(/[?#]/,1)[0]);
      const target=resolvePath(dirname(file),path);
      assert.ok(target.startsWith(dest+sep),'Asset escapes public directory: '+ref);
      await assert.doesNotRejects(stat(target),'Missing asset: '+file+' -> '+ref);
    }
  }
});
