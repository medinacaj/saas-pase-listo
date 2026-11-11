import { chileToday, weekBounds } from "./week-events.mjs";

// A featured slide must resolve to a real HTTPS image accepted by its poster renderer.
// DEMO uploads are allowed only with the explicitly declared (unverified) rights status.
export function hasHeroPoster(event, kind) {
 if(!event || typeof event.posterUrl!=="string")return false;
 try {
  const url=new URL(event.posterUrl);
  if(url.protocol!=="https:" || !url.hostname || url.username || url.password)return false;
  return kind==="reference" ||
    (kind==="demo" && event.posterRights==="declarados_por_usuario_sin_verificar");
 } catch { return false; }
}

// Picks editorial highlights from the catalog, without implying ticket availability.
// Priorities may be curated by the editor; expired events are excluded automatically.
export function selectHeroEvents(references, demos, today = chileToday(), limit = 6) {
 const {end} = weekBounds(today);
 const safeLimit=Number.isSafeInteger(limit)?Math.min(10,Math.max(1,limit)):6;
 const clean=(items,kind)=>Array.isArray(items)?items.filter(item=>
   item&&typeof item.id==="string"&&item.id.length<=160 &&
   typeof item.title==="string"&&item.title.trim() &&
   /^\d{4}-\d{2}-\d{2}$/.test(item.date||"") &&
   (kind==="reference"||item.status==="published") &&
   (item.endDate||item.date)>=today && hasHeroPoster(item,kind)
 ).map(item=>({...item,kind})):[];

 const unique=new Map();
 for(const event of [...clean(references,"reference"),...clean(demos,"demo")]){
  if(!unique.has(event.id))unique.set(event.id,event);
 }
 const events=[...unique.values()];
 const weight=e=>Math.min(100,Math.max(0,Number(e.heroPriority)||0))+(e.featured===true?10:0);
 const rank=(a,b)=>weight(b)-weight(a)||a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"es");
 const inWeek=events.filter(e=>e.date<=end&&(e.endDate||e.date)>=today).sort(rank);
 const upcoming=events.filter(e=>e.date>end).sort(rank);
 // Show up to four photographed events from this week, then fill remaining
 // slots with upcoming events that also have image URLs.
 const slots=Math.min(4,safeLimit);
 const picked=[...inWeek.slice(0,slots),...upcoming.slice(0,safeLimit-slots)];
 const seen=new Set(picked.map(e=>e.id));
 for(const event of [...inWeek.slice(slots),...upcoming.slice(safeLimit-slots)]){
  if(picked.length>=safeLimit)break;
  if(!seen.has(event.id)){picked.push(event);seen.add(event.id);}
 }
 return picked.slice(0,safeLimit);
}

export function splitHeroTitle(title,subtitle="") {
 const words=String(title||"").trim().split(/\s+/).filter(Boolean);
 if(words.length===0)return {main:"Eventos",accent:"en Chile."};
 if(words.length===1)return {main:words[0],accent:String(subtitle||"En vivo.").trim()};
 const split=words.length>3?Math.ceil(words.length/2):words.length-1;
 return {main:words.slice(0,split).join(" "),accent:words.slice(split).join(" ")+"."};
}
