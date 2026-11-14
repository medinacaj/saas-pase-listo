// PaseListo DEMO-only schematic, NOT verified seat geometry or an exact venue plan.
// Category colors are stable per ticket type order and shared between map and prices.
export const ZONE_COLORS = Object.freeze([
 "#EBAE60", // warm amber
 "#78B8A5", // sage
 "#A2A0D8", // violet
 "#EB9B91", // coral
 "#86B4D6", // blue
 "#B7CD78", // lime
 "#D6A4BC", // rose
 "#A8C3B8"  // mint
]);

export function buildVenueZones(ticketTypes) {
 if(!Array.isArray(ticketTypes))return [];
 const seen=new Set();
 return ticketTypes
  .filter(type=>typeof type?.id==="string" && type.id && !seen.has(type.id) && (seen.add(type.id),true))
  .slice(0,ZONE_COLORS.length)
  .sort((a,b)=>Number(b.priceClp||0)-Number(a.priceClp||0))
  .map((type,index)=>({
   id:type.id,name:String(type.name||"Zona "+(index+1)),
   priceClp:type.priceClp,
   color:ZONE_COLORS[index],
   index
  }));
}

export function zoneBandPath(index,count) {
 if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>8||index<0||index>=count) {
  throw Error("Zona de recinto inválida");
 }
 const start=146+index*(210/count);
 const end=146+(index+1)*(210/count)-5;
 const leftAt=y=>Math.round(166-(y-146)*.30);
 const rightAt=y=>680-leftAt(y);
 const curve=14;
 return [
  "M",leftAt(start),Math.round(start),
  "Q",340,Math.round(start-curve),rightAt(start),Math.round(start),
  "L",rightAt(end),Math.round(end),
  "Q",340,Math.round(end-curve),leftAt(end),Math.round(end),
  "Z"
 ].join(" ");
}

export function zoneBandLabelY(index,count) {
 if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>8||index<0||index>=count) {
  throw Error("Zona de recinto inválida");
 }
 return Math.round(146+(index+.5)*(210/count)-4);
}
