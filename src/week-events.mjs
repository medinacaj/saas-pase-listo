import { eventDetailHref } from "./event-page-domain.mjs";

// Calendar weeks run Monday–Sunday in Chile; ISO calendar arithmetic is in UTC
// to avoid DST changing a date when adding whole days.
const validDate = value => {
 if(typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const stamp=Date.parse(value+"T12:00:00Z");
 return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10)===value;
};
const shift = (value,offset) => {
 const day=new Date(value+"T12:00:00Z");
 day.setUTCDate(day.getUTCDate()+offset);
 return day.toISOString().slice(0,10);
};
export function chileToday(now=new Date()) {
 return new Intl.DateTimeFormat("sv-SE",{
  timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"
 }).format(now);
}
export function weekBounds(today) {
 if(!validDate(today))throw Error("Fecha de referencia inválida");
 const weekday=new Date(today+"T12:00:00Z").getUTCDay();
 const monday=shift(today,-((weekday+6)%7));
 return {start:monday,end:shift(monday,6)};
}
export function weeklyEventSelection(references,demos,today=chileToday(),limit=4) {
 const bounds=weekBounds(today);
 const safeLimit=Number.isSafeInteger(limit)?Math.min(30,Math.max(1,limit)):4;
 const decorate=(events,kind)=>Array.isArray(events)?events
  .filter(e=>e && typeof e.id==="string" && e.id.length<=160 && validDate(e.date) &&
   (kind==="reference" || e.status==="published"))
  .map(e=>({
   id:e.id,title:String(e.title||"Evento"),city:String(e.city||"Chile"),
   date:e.date,endDate:validDate(e.endDate)?e.endDate:e.date,kind
  })):[];
 const unique=new Map();
 for(const item of [...decorate(references,"reference"),...decorate(demos,"demo")]){
  if(!unique.has(item.id))unique.set(item.id,item);
 }
 const events=[...unique.values()].filter(e=>e.endDate>=today)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"es"));
 const week=events.filter(e=>e.date<=bounds.end && e.endDate>=bounds.start);
 const upcoming=events.filter(e=>e.date>bounds.end);
 return {bounds,week:week.slice(0,safeLimit),upcoming:upcoming.slice(0,safeLimit),weekCount:week.length};
}
const readable = iso => new Intl.DateTimeFormat("es-CL",{
 timeZone:"UTC",day:"numeric",month:"short"
}).format(new Date(iso+"T12:00:00Z")).replace(".","");
export function renderWeekStrip(references,demos,root=document,today=chileToday()) {
 const strip=root.querySelector("#week-strip");
 if(!strip)return;
 const target=strip.querySelector("#week-strip-events");
 const label=strip.querySelector("#week-strip-range");
 const {bounds,week,upcoming,weekCount}=weeklyEventSelection(references,demos,today,24);
 label.textContent=readable(bounds.start)+"–"+readable(bounds.end);
 target.replaceChildren();
 const showing=weekCount?week:upcoming;
 if(!weekCount){
  const empty=root.createElement("span");
  empty.className="week-strip-empty";
  empty.textContent="Sin eventos esta semana"+(showing.length?" · Próximos:":"");
  target.append(empty);
 }
 if(weekCount>week.length){
  const count=root.createElement("span");
  count.className="week-strip-extra";
  count.textContent="+"+(weekCount-week.length)+" más";
  target.append(count);
 }
 for(const event of showing){
  const link=root.createElement("a");
  link.className="week-strip-event";
  link.href=eventDetailHref(event.id);
  link.title=event.title+" · "+event.city+" · "+(event.kind==="reference"?"Solo referencia, sin venta":"Evento ficticio DEMO");
  const date=root.createElement("span");
  date.className="week-strip-date";
  date.textContent=event.date<today?"En curso":readable(event.date);
  const name=root.createElement("strong");
  name.textContent=event.title;
  const category=root.createElement("span");
  category.className="week-strip-kind";
  category.textContent=event.kind==="reference"?"Referencia":"DEMO";
  link.append(date,name,category);
  target.append(link);
 }
 if(!weekCount && !upcoming.length){
  const empty=root.createElement("span");
  empty.className="week-strip-empty";
  empty.textContent="No hay próximos eventos anunciados";
  target.replaceChildren(empty);
 }
 strip.hidden=false;
}
