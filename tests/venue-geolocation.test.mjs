import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
 venueKey, locateVenue, osmEmbedUrl, osmLocationUrl, osmVenueSearchUrl
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

test("OSM ofrece mapa integrado con pin y enlace directo al mismo lugar",()=>{
 const place=locateVenue({venue:"Teatro Caupolicán",city:"Santiago"},registry);
 const url=new URL(osmEmbedUrl(place));
 assert.equal(url.origin,"https://www.openstreetmap.org");
 assert.equal(url.pathname,"/export/embed.html");
 assert.equal(url.searchParams.get("layer"),"mapnik");
 assert.equal(url.searchParams.get("marker"),"-33.45622,-70.64924");
 const bbox=url.searchParams.get("bbox").split(",").map(Number);
 assert.equal(bbox.length,4);
 assert.ok(bbox[0]<place.lon && bbox[2]>place.lon);
 assert.ok(bbox[1]<place.lat && bbox[3]>place.lat);
 const direct=new URL(osmLocationUrl(place));
 assert.equal(direct.origin,url.origin);
 assert.equal(direct.searchParams.get("mlat"),String(place.lat));
 assert.equal(direct.searchParams.get("mlon"),String(place.lon));
 assert.ok(direct.hash.startsWith("#map=16/"));
});

test("sin coordenadas acreditadas no se asigna marcador ni se geocodifica por lotes",()=>{
 assert.equal(locateVenue({venue:"Teatro inventado",city:"Santiago"},registry),null);
 assert.equal(locateVenue(demo.events[0],registry),null);
 assert.equal(locateVenue({venue:"Santander Arena",city:"Concepción"},registry),null);
 assert.equal(locateVenue({venue:"Santander Arena",city:"Santiago"},{
  venues:[{venue:"Santander Arena",city:"Santiago",country:"Chile",lat:120,lon:20,source:"https://mapcarta.com/es/x"}]
 }),null);
 assert.throws(()=>osmEmbedUrl({lat:NaN,lon:50}),/Coordenadas inválidas/);
 assert.throws(()=>osmLocationUrl({lat:-33,lon:Infinity}),/Coordenadas inválidas/);
 const url=new URL(osmVenueSearchUrl({venue:"Parque Ciudad Empresarial",city:"Santiago"}));
 assert.equal(url.origin,"https://www.openstreetmap.org");
 assert.equal(url.pathname,"/search");
 assert.equal(url.searchParams.get("query"),"Parque Ciudad Empresarial, Santiago, Chile");
});

test("ficha usa mapa OSM perezoso, conserva atribución y distingue plano de zonas",async()=>{
 const [html,js,css,server,packageJson]=await Promise.all([
  read("../evento.html"),read("../src/event-page.mjs"),read("../src/event-page.css"),
  read("../server/buyer-server.mjs"),read("../package.json").then(JSON.parse)
 ]);
 for(const id of ["venue-geolocation-map","venue-geolocation-status",
  "venue-geolocation-note","venue-geolocation-link","venue-geolocation-search"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('id="venue-zone-map"'),"El mapa de categorías debe permanecer");
 assert.ok(html.includes("colaboradores de OpenStreetMap"));
 assert.ok(js.includes("renderGeolocation(event,reference,geoRegistry)"));
 assert.ok(js.includes("locateVenue(event,registry)"));
 assert.ok(js.includes('iframe.loading="lazy"'));
 assert.ok(js.includes('iframe.referrerPolicy="strict-origin-when-cross-origin"'));
 assert.ok(js.includes("osmEmbedUrl(venue)"));
 assert.ok(js.includes("osmLocationUrl(venue)"));
 assert.ok(js.includes("osmVenueSearchUrl(event)"));
 assert.ok(js.includes("Este recinto pertenece a la demostración"));
 assert.ok(js.includes("No mostraremos un marcador aproximado"));
 assert.ok(css.includes(".venue-geolocation-map iframe"));
 assert.ok(server.includes('["/src/venue-geolocation.mjs", ["src/venue-geolocation.mjs", "text/javascript"]]'));
 assert.ok(server.includes('["/data/recintos-openstreetmap.json", ["data/recintos-openstreetmap.json", "application/json"]]'));
 assert.ok(packageJson.scripts.check.includes("node --check src/venue-geolocation.mjs"));
 const module=await read("../src/venue-geolocation.mjs");
 assert.ok(!module.includes("nominatim.openstreetmap.org"));
});
