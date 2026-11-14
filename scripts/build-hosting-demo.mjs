import { cp, lstat, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
const files=['index.html','evento.html','admin.html','organizador.html','laboratorio.html','favicon.svg'];
const allowedDirectories=new Map([
  ['src',new Set(['.mjs','.css'])],
  ['data',new Set(['.json'])],
  ['assets/event-art',new Set(['.svg'])]
]);
function suffix(path){return path.slice(path.lastIndexOf('.'))}
async function copySafe(from,to,extensions){
  const info=await lstat(from);
  if(info.isSymbolicLink())throw Error('No se admite un enlace simbólico: '+relative(root,from));
  if(info.isDirectory()){
    await mkdir(to,{recursive:true});
    for(const entry of await readdir(from))await copySafe(join(from,entry),join(to,entry),extensions);
    return;
  }
  if(!info.isFile()||!extensions.has(suffix(from)))throw Error('Asset no admitido: '+relative(root,from));
  await mkdir(resolve(to,'..'),{recursive:true});
  await cp(from,to,{force:false,errorOnExist:true});
}
if(out===root||!out.startsWith(root+sep))throw Error('Ruta de salida inválida');
const home=await readFile(join(root,'index.html'),'utf8');
if(!/name="robots"\s+content="noindex,nofollow"/i.test(home)||
   !/demostrati|demo|simulad/i.test(home))throw Error('El portal debe continuar marcado como demostración no indexable');
await rm(out,{force:true,recursive:true});
await mkdir(out,{recursive:true});
for(const file of files)await copySafe(join(root,file),join(out,file),new Set(['.html','.svg']));
for(const [dir,extensions] of allowedDirectories)await copySafe(join(root,dir),join(out,dir),extensions);
await writeFile(join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(join(out,'.nojekyll'),'');
for(const asset of ['src/marketplace.mjs','src/checkout-state.mjs','src/reference-checkout.mjs','src/event-page.mjs','src/venue-zones.mjs','data/eventos-reales-referencia.json']){
  await lstat(join(out,asset));
}
for(const forbidden of ['server','db','tests','.github','.local','package.json','README.md']){
  try{await lstat(join(out,forbidden));throw Error('Material ajeno a la demo: '+forbidden)}
  catch(err){if(err.code!=='ENOENT')throw err}
}
console.log('PaseListo: paquete estático DEMO generado en dist; sin backend ni pagos reales.');
