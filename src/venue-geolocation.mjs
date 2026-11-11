// PaseListo geolocation helpers. No automated public geocoding requests.
// Only place an OpenStreetMap pin on an explicitly matched and validated venue.
const isFiniteCoordinate=(lat,lon)=>typeof lat==="number" && typeof lon==="number" &&
 Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;

export function venueKey(venue,city) {
 if(typeof venue!=="string"||typeof city!=="string")return "";
 return [venue,city].map(value=>value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .trim().replace(/\s+/g," ").toLowerCase()).join("|");
}

export function locateVenue(event,registry) {
 if(!event || !registry || !Array.isArray(registry.venues))return null;
 // Do not guess a map location for demo/fictitious venues.
 if(String(event.venue||"").toLowerCase().includes("demo"))return null;
 const match=registry.venues.find(item=>venueKey(item.venue,item.city)===
  venueKey(event.venue,event.city));
 if(!match || !isFiniteCoordinate(match.lat,match.lon))return null;
 if(match.country!=="Chile" || !/^https:\/\/mapcarta\.com\//.test(match.source||""))return null;
 return match;
}

export function osmEmbedUrl(venue) {
 if(!venue || !isFiniteCoordinate(venue.lat,venue.lon))throw Error("Coordenadas inválidas");
 const {lat,lon}=venue;
 const halfWidth=.0065,halfHeight=.0038;
 const bounds=[lon-halfWidth,lat-halfHeight,lon+halfWidth,lat+halfHeight]
  .map(value=>value.toFixed(5)).join(",");
 const query=new URLSearchParams({bbox:bounds,layer:"mapnik",marker:lat+","+lon});
 return "https://www.openstreetmap.org/export/embed.html?"+query.toString();
}

export function osmLocationUrl(venue) {
 if(!venue || !isFiniteCoordinate(venue.lat,venue.lon))throw Error("Coordenadas inválidas");
 return "https://www.openstreetmap.org/?mlat="+venue.lat+
  "&mlon="+venue.lon+"#map=16/"+venue.lat+"/"+venue.lon;
}

export function osmVenueSearchUrl(event) {
 if(!event || typeof event.venue!=="string" || typeof event.city!=="string" ||
    !event.venue.trim() || !event.city.trim())throw Error("Recinto no válido");
 const query=[event.venue,event.city,"Chile"].join(", ");
 return "https://www.openstreetmap.org/search?query="+encodeURIComponent(query);
}
