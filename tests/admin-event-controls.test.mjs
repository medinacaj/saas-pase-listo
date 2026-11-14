import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {seedCommerce,createOrganizerEvent,eventTicketLimit} from "../src/commerce-domain.mjs";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
const catalog=JSON.parse(await read("../data/eventos-clientes-demo.json"));
const defaults={title:"Prueba masiva",venue:"Recinto ficticio",city:"Santiago",
 date:"2027-09-09",time:"19:00",category:"Festivales",priceClp:18000,description:"Un evento inventado de prueba",capacity:6000};
test("panel ofrece siete boletos por comprador y activa espera masiva",async()=>{
 const [html,js]=await Promise.all([read("../admin.html"),read("../src/control.mjs")]);
 assert.match(html,/name="maxTicketsPerPerson" value="7"/);
 assert.match(html,/id="event-waitlist-enabled"/);
 assert.match(html,/5\.000 cupos/);
 assert.ok(html.includes("Activar lista de espera virtual"));
 assert.ok(js.includes("syncWaitlistCapacity"));
 assert.ok(js.includes("data.capacity>=5000"));
 assert.ok(js.includes("toggle.disabled=true"));
 assert.ok(js.includes("data.waitlistEnabled=data.capacity>=5000"));
 const s=seedCommerce(catalog);
 const mass=createOrganizerEvent(s,"org-aurora",{...defaults,waitlistEnabled:false});
 assert.equal(mass.maxTicketsPerPerson,7);
 assert.equal(mass.waitlistEnabled,true);
 const smaller=createOrganizerEvent(s,"org-aurora",{...defaults,capacity:99,waitlistEnabled:false});
 assert.equal(smaller.waitlistEnabled,false);
 const optional=createOrganizerEvent(s,"org-aurora",{...defaults,capacity:99,waitlistEnabled:true,maxTicketsPerPerson:3});
 assert.equal(optional.waitlistEnabled,true);
 assert.equal(eventTicketLimit(optional),3);
 assert.throws(()=>createOrganizerEvent(s,"org-aurora",{...defaults,waitlistEnabled:"false"}),/inválida/);
});
test("la app no promete controles de seguridad reales en GitHub Pages",async()=>{
 const html=await read("../admin.html");
 assert.ok(html.includes("VERSIÓN PÚBLICA Y SIN LOGIN"));
 assert.ok(html.includes("Acceso exclusivo de propietario"));
 assert.ok(html.includes("Pendiente"));
});
