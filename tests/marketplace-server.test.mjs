import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMarketplaceServer } from "../server/marketplace-api.mjs";
const tokens={"org-aurora":"dev-secret-aurora-abcdef1234567890","org-escena":"dev-secret-escena-abcdef1234567890","org-nexo":"dev-secret-nexo-abcdef1234567890"};
async function setup(t) {
 const dir=await mkdtemp(join(tmpdir(),"paselisto-market-"));
 const {server,ready}=buildMarketplaceServer({tokens,filePath:join(dir,"state.json")});
 await ready;
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 t.after(async()=>{await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});});
 const url="http://127.0.0.1:"+server.address().port;
 const call=async(path,tenant,data,key)=>{
  const r=await fetch(url+path,{method:data?"POST":"GET",headers:{Authorization:tenant?"Bearer "+tokens[tenant]:"","Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{})},...(data?{body:JSON.stringify(data)}:{})});
  return {status:r.status,body:await r.json()};
 };
 return call;
}
test("API de negocio protege vistas y ventas por organización",async(t)=>{
 const call=await setup(t);
 assert.equal((await call("/api/v1/snapshot")).status,401);
 const e={title:"Evento de prueba",venue:"Recinto DEMO",city:"Concepción",date:"2027-06-10",time:"19:00",category:"Música",priceClp:15000,capacity:1,description:"Evento de prueba para revisar B2B2C"};
 const created=await call("/api/v1/market/events","org-escena",e);
 assert.equal(created.status,201);
 assert.equal((await call("/api/v1/snapshot","org-aurora")).body.events.some(x=>x.id===created.body.id),false);
 assert.equal((await call("/api/v1/market/orders","org-aurora",{eventId:created.body.id,ticketTypeId:"general",quantity:1,alias:"Persona DEMO"})).status,404);
 const sale=await call("/api/v1/market/orders","org-escena",{eventId:created.body.id,ticketTypeId:"general",quantity:1,alias:"Persona DEMO"},"order-idempotent-1");
 assert.equal(sale.status,201);
 assert.equal(sale.body.pricing.totalClp,17000);
 assert.equal((await call("/api/v1/market/orders","org-escena",{eventId:created.body.id,ticketTypeId:"general",quantity:1,alias:"Persona DEMO"})).status,409);
 assert.equal((await call("/api/v1/market/orders/cancel","org-aurora",{orderId:sale.body.id})).status,404);
 assert.equal((await call("/api/v1/snapshot","org-aurora")).body.orders.length,0);
});
test("peticiones simultáneas DEMO se serializan y no duplican idempotency key",async(t)=>{
 const call=await setup(t);
 const p={eventId:"demo-noches-aurora",ticketTypeId:"general",quantity:1,alias:"Cliente DEMO"};
 const [a,b]=await Promise.all([call("/api/v1/market/orders","org-aurora",p,"key-one-12345"),call("/api/v1/market/orders","org-aurora",p,"key-one-12345")]);
 assert.deepEqual([a.status,b.status].sort(),[200,201]);
 const v=await call("/api/v1/snapshot","org-aurora");
 assert.equal(v.body.orders.length,1);
 assert.equal(v.body.metrics.ticketsSimulated,1);
});
