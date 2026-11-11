// Visual checkout simulation for non-contracted reference events.
// Prices, categories, service charges and reference numbers are fictional.
// No real stock, charge, reservation, valid ticket, account or authorization.
export const DEMO_REFERENCE_TIERS=Object.freeze([
 Object.freeze({id:"general",name:"General · DEMO",priceClp:20000}),
 Object.freeze({id:"preferente",name:"Preferente · DEMO",priceClp:35000}),
 Object.freeze({id:"vip",name:"VIP · DEMO",priceClp:60000})
]);
export const REFERENCE_CHECKOUT_MAX_QUANTITY=6;
export function referenceQuote(event,tierId,quantity){
 if(!event || !/^ref-[a-z0-9-]+$/.test(event.id||""))throw Error("Evento de referencia no válido");
 const tier=DEMO_REFERENCE_TIERS.find(item=>item.id===tierId);
 if(!tier)throw Error("Categoría de prueba inválida");
 const qty=Number(quantity);
 if(!Number.isSafeInteger(qty)||qty<1||qty>REFERENCE_CHECKOUT_MAX_QUANTITY)
  throw Error("Cantidad de prueba fuera de rango");
 const subtotalClp=tier.priceClp*qty;
 const serviceFeeClp=Math.round(subtotalClp*.10);
 return {eventId:event.id,tierId:tier.id,tierName:tier.name,quantity:qty,
  unitClp:tier.priceClp,subtotalClp,serviceFeeClp,totalClp:subtotalClp+serviceFeeClp,
  demo:true};
}
export function referenceOrderReceipt(quote,nonce){
 if(!quote?.demo || !Number.isSafeInteger(quote.totalClp) || quote.totalClp<0)
  throw Error("Resumen de demostración inválido");
 if(typeof nonce!=="string" || !/^[a-z0-9-]{8,80}$/i.test(nonce))
  throw Error("Identificador de demostración inválido");
 return {id:"SIM-"+nonce.slice(0,12).toUpperCase(),eventId:quote.eventId,
  tierName:quote.tierName,quantity:quote.quantity,totalClp:quote.totalClp,
  status:"simulated_only",paymentProcessed:false,ticketIssued:false};
}
