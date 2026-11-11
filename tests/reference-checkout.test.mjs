import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
 DEMO_REFERENCE_TIERS,REFERENCE_CHECKOUT_MAX_QUANTITY,referenceQuote,referenceOrderReceipt
} from "../src/reference-checkout.mjs";

test("precios y cargos de prueba se calculan sin alterar el catálogo real",()=>{
 const event={id:"ref-camila-2026"};
 const sample=referenceQuote(event,"preferente",2);
 assert.deepEqual(sample,{
  eventId:"ref-camila-2026",tierId:"preferente",tierName:"Preferente · DEMO",
  quantity:2,unitClp:35000,subtotalClp:70000,serviceFeeClp:7000,totalClp:77000,demo:true
 });
 assert.equal(DEMO_REFERENCE_TIERS.length,3);
 assert.equal(REFERENCE_CHECKOUT_MAX_QUANTITY,6);
 assert.equal(referenceQuote(event,"general","1").totalClp,22000);
 assert.equal(referenceQuote(event,"vip",6).totalClp,396000);
});
test("la simulación nunca genera pagos, reservas ni entradas reales",()=>{
 const quote=referenceQuote({id:"ref-gorillaz-2026"},"general",1);
 const receipt=referenceOrderReceipt(quote,"f3bc56f0-7c68-48de-a191-9a1b76aee435");
 assert.equal(receipt.status,"simulated_only");
 assert.equal(receipt.paymentProcessed,false);
 assert.equal(receipt.ticketIssued,false);
 assert.equal(receipt.id,"SIM-F3BC56F0-7C6");
 assert.equal(receipt.totalClp,22000);
 for(const input of [0,7,-1,2.4,Infinity,"muchas",null]){
  assert.throws(()=>referenceQuote({id:"ref-camila-2026"},"general",input));
 }
 assert.throws(()=>referenceQuote({id:"demo-noches-aurora"},"general",1),/referencia no válido/);
 assert.throws(()=>referenceQuote({id:"ref-camila-2026"},"inventado",1),/Categoría de prueba inválida/);
 assert.throws(()=>referenceOrderReceipt(quote,"???"),/Identificador/);
});
test("las fichas reales tienen imágenes y descripción pero precios oficiales no atribuidos",async()=>{
 const catalog=JSON.parse(await readFile(new URL("../data/eventos-reales-referencia.json",import.meta.url),"utf8"));
 const examples=catalog.events.filter(e=>Boolean(e.posterUrl));
 assert.equal(examples.length,6);
 assert.ok(examples.every(e=>e.description?.length>=40));
 assert.ok(examples.every(e=>!e.ticketTypes && !e.priceClp && !e.saleEnabled));
 const page=await readFile(new URL("../src/event-page.mjs",import.meta.url),"utf8");
 assert.ok(page.includes("DEMO_REFERENCE_TIERS"));
 assert.ok(page.includes("renderReferenceCheckout(event)"));
 assert.ok(page.includes("changeDemoTier?.(target.dataset.zoneSelect)"));
 assert.ok(page.includes("No solicitamos datos bancarios ni personales."));
});
