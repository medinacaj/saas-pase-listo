// PaseListo geolocation helpers. No automated public geocoding requests.
// Only place a marker for an explicitly matched and validated venue.
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

const coordinates = venue => {
 if(!venue || !isFiniteCoordinate(venue.lat,venue.lon))throw Error("Coordenadas inválidas");
 return venue.lat+","+venue.lon;
};

// Google Maps Embed API is supported when a browser-restricted Google key is
// supplied; an older keyless Google Maps iframe is used for the static DEMO.
// The latter is best effort, not a documented production API.
export function googleMapsEmbedUrl(venue, key="") {
 const q=coordinates(venue);
 if(key) {
  if(typeof key!=="string" || !/^[A-Za-z0-9_-]{25,200}$/.test(key))
    throw Error("Clave pública de Google Maps inválida");
  const params=new URLSearchParams({key,q,zoom:"16",language:"es"});
  return "https://www.google.com/maps/embed/v1/place?"+params.toString();
 }
 const params=new URLSearchParams({q,z:"16",output:"embed",hl:"es"});
 return "https://maps.google.com/maps?"+params.toString();
}

export function googleMapsLocationUrl(venue) {
 const params=new URLSearchParams({api:"1",query:coordinates(venue)});
 return "https://www.google.com/maps/search/?"+params.toString();
}

export function googleMapsVenueSearchUrl(event) {
 if(!event || typeof event.venue!=="string" || typeof event.city!=="string" ||
    !event.venue.trim() || !event.city.trim())throw Error("Recinto no válido");
 const query=[event.venue,event.city,"Chile"].join(", ");
 const params=new URLSearchParams({api:"1",query});
 return "https://www.google.com/maps/search/?"+params.toString();
}
