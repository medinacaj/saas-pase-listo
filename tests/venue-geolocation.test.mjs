import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
 venueKey, locateVenue, googleMapsEmbedUrl, googleMapsLocationUrl, googleMapsVenueSearchUrl
} from "../src/venue-geolocation.mjs";

const read=async name=>readFile(new URL(name,import.meta.url),"utf8");
const [registry,real,demo]=await Promise.all([
 read("../data/recintos-openstreetmap.json").then(JSON.parse),
 read("../data/eventos-reales-referencia.json").then(JSON.parse),
 read("../data/eventos-clientes-demo.json").then(JSON.parse)
]);

test("registro OSM: coordenadas únicas y respaldadas para recintos reales",()=>{
 assert.ok(registry.venues.length>=10);
 const keys=registry.venues.map(e=>venueKey(e.venue,e.city));
 assert.equal(new Set(keys).size,keys.length);
 for(const place of registry.venues){
  assert.equal(place.country,"Chile");
  assert.ok(place.lat>=-56 && place.lat<=-17);
  assert.ok(place.lon>=-76 && place.lon<=-66);
  assert.match(place.source,/^https:\/\/mapcarta\.com\//);
  assert.match(place.osmType,/^(way|node|relation)$/);
  assert.ok(Number.isSafeInteger(place.osmId) && place.osmId>0);
  assert.ok(place.note.length>20);
 }
 const venue={venue:"Santander Arena",city:"Santiago"};
 const found=locateVenue(venue,registry);
 assert.equal(found.lat,-33.46273);
 assert.equal(found.lon,-70.66194);
 assert.equal(locateVenue({venue:"Teatro Universidad de Concepcion",city:"Concepción"},registry)?.city,"Concepción");
 assert.ok(real.events.filter(event=>locateVenue(event,registry)).length>=16);
});

test("Google Maps incorpora coordenadas del recinto con enlace externo",()=>{
 const place=locateVenue({venue:"Teatro Caupolicán",city:"Santiago"},registry);
 const url=new URL(googleMapsEmbedUrl(place));
 assert.equal(url.origin,"https://maps.google.com");
 assert.equal(url.pathname,"/maps");
 assert.equal(url.searchParams.get("output"),"embed");
 assert.equal(url.searchParams.get("q"),"-33.45622,-70.64924");
 assert.equal(url.searchParams.get("z"),"16");
 assert.equal(url.searchParams.get("hl"),"es");
 const official=new URL(googleMapsEmbedUrl(place,"AIzaExampleGoogleMapsPublicRestrictedKey123"));
 assert.equal(official.origin,"https://www.google.com");
 assert.equal(official.pathname,"/maps/embed/v1/place");
 assert.equal(official.searchParams.get("q"),"-33.45622,-70.64924");
 assert.equal(official.searchParams.get("zoom"),"16");
 assert.throws(()=>googleMapsEmbedUrl(place,"invalid key"),/Clave pública/);
 const direct=new URL(googleMapsLocationUrl(place));
 assert.equal(direct.origin,"https://www.google.com");
 assert.equal(direct.searchParams.get("api"),"1");
 assert.equal(direct.searchParams.get("query"),"-33.45622,-70.64924");
 assert.ok(direct.pathname.includes("/maps/search/"));
});

test("sin coordenadas acreditadas no se asigna marcador ni se geocodifica por lotes",()=>{
 assert.equal(locateVenue({venue:"Teatro inventado",city:"Santiago"},registry),null);
 assert.equal(locateVenue(demo.events[0],registry),null);
 assert.equal(locateVenue({venue:"Santander Arena",city:"Concepción"},registry),null);
 assert.equal(locateVenue({venue:"Santander Arena",city:"Santiago"},{
  venues:[{venue:"Santander Arena",city:"Santiago",country:"Chile",lat:120,lon:20,source:"https://mapcarta.com/es/x"}]
 }),null);
 assert.throws(()=>googleMapsEmbedUrl({lat:NaN,lon:50}),/Coordenadas inválidas/);
 assert.throws(()=>googleMapsLocationUrl({lat:-33,lon:Infinity}),/Coordenadas inválidas/);
 const url=new URL(googleMapsVenueSearchUrl({venue:"Parque Ciudad Empresarial",city:"Santiago"}));
 assert.equal(url.origin,"https://www.google.com");
 assert.equal(url.pathname,"/maps/search/");
 assert.equal(url.searchParams.get("query"),"Parque Ciudad Empresarial, Santiago, Chile");
 assert.equal(url.searchParams.get("api"),"1");
});

test("ficha usa Google Maps perezoso, fuente visible y plano de zonas independiente",async()=>{
 const [html,js,css,server,packageJson]=await Promise.all([
  read("../evento.html"),read("../src/event-page.mjs"),read("../src/event-page.css"),
  read("../server/buyer-server.mjs"),read("../package.json").then(JSON.parse)
 ]);
 for(const id of ["venue-geolocation-map","venue-geolocation-status",
  "venue-geolocation-note","venue-geolocation-link","venue-geolocation-search"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('id="venue-zone-map"'),"El mapa de categorías debe permanecer");
 assert.ok(html.includes("Google Maps"));
 assert.ok(html.includes("Coordenadas de referencia"));
 assert.ok(html.includes('name="google-maps-embed-key"'));
 assert.ok(js.includes("renderGeolocation(event,reference,geoRegistry)"));
 assert.ok(js.includes("locateVenue(event,registry)"));
 assert.ok(js.includes('iframe.loading="lazy"'));
 assert.ok(js.includes('iframe.referrerPolicy="strict-origin-when-cross-origin"'));
 assert.ok(js.includes("googleMapsEmbedUrl(venue,publicMapsKey)"));
 assert.ok(js.includes("googleMapsLocationUrl(venue)"));
 assert.ok(js.includes("googleMapsVenueSearchUrl(event)"));
 assert.ok(js.includes("Este recinto pertenece a la demostración"));
 assert.ok(js.includes("No mostraremos un marcador aproximado"));
 assert.ok(css.includes(".venue-geolocation-map iframe"));
 assert.ok(server.includes('["/src/venue-geolocation.mjs", ["src/venue-geolocation.mjs", "text/javascript"]]'));
 assert.ok(server.includes('["/data/recintos-openstreetmap.json", ["data/recintos-openstreetmap.json", "application/json"]]'));
 assert.ok(packageJson.scripts.check.includes("node --check src/venue-geolocation.mjs"));
 const module=await read("../src/venue-geolocation.mjs");
 assert.ok(!module.includes("nominatim.openstreetmap.org"));
});
