// Local-only B2B2C demo backend. Does not process real money or accept public customer credentials.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createDemoApi } from "./runtime.mjs";
import { seedCommerce, createOrganizerEvent, organizerEvents, ordersForOrganizer, statsForOrganizer, simulateOrder, cancelSimulatedOrder } from "../src/commerce-domain.mjs";
const staticRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const catalog=JSON.parse(readFileSync(resolve(staticRoot,"data/eventos-clientes-demo.json"),"utf8"));
function seed(){
 const market=seedCommerce(catalog);
 return {...market,tenants:catalog.organizers.map(o=>({id:o.id,name:o.name})),tickets:[]};
}
function view(store,tenantId){
 return {
  organization:store.organizers.find(o=>o.id===tenantId),
  events:organizerEvents(store,tenantId),
  orders:ordersForOrganizer(store,tenantId),
  metrics:statsForOrganizer(store,tenantId),
  contract:store.contract,
  notice:"Servidor local de DEMO; sin pagos, reservas ni emisión real"
 };
}
function simulateScoped(store,tenantId,payload){
 const event=store.events.find(e=>e.id===payload.eventId && e.organizerId===tenantId);
 if(!event)throw Error("Evento no encontrado para este organizador");
 return simulateOrder(store,payload);
}
export function buildMarketplaceServer({tokens,filePath=resolve(staticRoot,".local","commerce.json")}){
 return createDemoApi({
  seed,
  tokens,
  filePath,
  staticRoot,
  handlers:{
   product:"PaseListo B2B2C DEMO",
   view,
   actions:{
    "/api/v1/market/events":(s,tenant,p)=>createOrganizerEvent(s,tenant,p),
    "/api/v1/market/orders":(s,tenant,p)=>simulateScoped(s,tenant,p),
    "/api/v1/market/orders/cancel":(s,tenant,p)=>cancelSimulatedOrder(s,tenant,p.orderId)
   }
  }
 });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let tokens;
 try{tokens=JSON.parse(process.env.PASELISTO_DEMO_KEYS||"{}");}
 catch{console.error("PASELISTO_DEMO_KEYS debe ser un objeto JSON");process.exit(1);}
 try{
  const {server,ready}=buildMarketplaceServer({tokens});
  ready.then(()=>server.listen(8081,"127.0.0.1",()=>console.log("PaseListo commerce API DEMO: http://127.0.0.1:8081")))
    .catch(err=>{console.error(err.message);process.exit(1);});
 }catch(err){console.error(err.message);process.exit(1);}
}
