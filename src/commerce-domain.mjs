// PaseListo B2B2C demo: pricing and simulated orders only. No real payments, fiscal documents or valid entries.
const fail = (message) => { throw new Error(message); };
const bounded = (value, min, max, label) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(label + " fuera de rango");
  return n;
};
const text = (value, min, max, label) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length < min || normalized.length > max) fail(label + " inválido");
  return normalized;
};
const id = () => crypto.randomUUID();
const clamp = (value) => Math.round(value);
const iso = () => new Date().toISOString();
const known = (store, organizationId) => store.organizers.find((o) => o.id === organizationId) || fail("Organización DEMO desconocida");
const eventOrFail = (store, eventId) => store.events.find((e) => e.id === eventId) || fail("Evento no encontrado");
const typeOrFail = (event, ticketTypeId) => event.ticketTypes.find((t) => t.id === ticketTypeId) || fail("Tipo de entrada inexistente");
export function seedCommerce(catalog) {
  if (!catalog || !Array.isArray(catalog.organizers) || !Array.isArray(catalog.events) || !catalog.contractExample) fail("Catálogo DEMO inválido");
  return {
    version: 1,
    organizers: structuredClone(catalog.organizers),
    events: structuredClone(catalog.events),
    contract: structuredClone(catalog.contractExample),
    orders: [],
    audit: [],
    updatedAt: iso()
  };
}
export function loadCommerce(catalog, storage = typeof localStorage === "undefined" ? null : localStorage) {
  const seed = () => seedCommerce(catalog);
  if (!storage) return seed();
  try {
    const raw = storage.getItem("paselisto:commerce:demo:v1");
    if (!raw || raw.length > 350000) return seed();
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.orders) || !Array.isArray(value.events) || !Array.isArray(value.organizers) || !Array.isArray(value.audit)) return seed();
    return value;
  } catch { return seed(); }
}
export function saveCommerce(store, storage = typeof localStorage === "undefined" ? null : localStorage) {
  if (!storage) return false;
  try {
    const json = JSON.stringify(store);
    if (json.length > 350000) return false;
    storage.setItem("paselisto:commerce:demo:v1", json);
    return true;
  } catch { return false; }
}
export function clearCommerce(storage = typeof localStorage === "undefined" ? null : localStorage) {
  try { storage?.removeItem("paselisto:commerce:demo:v1"); } catch { /* optional */ }
}
export function publishedEvents(store) {
  return store.events.filter((e) => e.status === "published");
}
export function organizerEvents(store, organizationId) {
  known(store, organizationId);
  return store.events.filter((e) => e.organizerId === organizationId);
}
export function ordersForOrganizer(store, organizationId) {
  known(store, organizationId);
  return store.orders.filter((o) => o.organizerId === organizationId);
}
export function available(store, eventId, ticketTypeId) {
  const event = eventOrFail(store, eventId);
  const type = typeOrFail(event, ticketTypeId);
  const simulatedQty = store.orders.filter((o) => o.eventId === eventId && o.ticketTypeId === ticketTypeId && o.status === "demo_confirmed").reduce((sum, o) => sum + o.quantity, 0);
  return Math.max(0, type.capacity - simulatedQty);
}
export function quote(store, eventId, ticketTypeId, quantityInput) {
  const event = eventOrFail(store, eventId);
  if (event.status !== "published") fail("Este evento no está publicado");
  const type = typeOrFail(event, ticketTypeId);
  const quantity = bounded(quantityInput, 1, 6, "Cantidad");
  if (!Number.isSafeInteger(type.capacity) || type.capacity < 0) fail("Aforo DEMO inválido");
  if (available(store, eventId, ticketTypeId) < quantity) fail("Entradas DEMO insuficientes");
  const bps = bounded(store.contract.buyerFeeBps, 0, 4000, "Porcentaje de servicio");
  const fixed = bounded(store.contract.buyerFeeFixedClp, 0, 20000, "Cargo fijo");
  const baseClp = bounded(type.priceClp, 0, 5000000, "Precio base");
  const feePerTicketClp = clamp(baseClp * bps / 10000) + fixed;
  const faceValueClp = baseClp * quantity;
  const serviceFeeClp = feePerTicketClp * quantity;
  const totalClp = faceValueClp + serviceFeeClp;
  const organizer = known(store, event.organizerId);
  const venueShareBps = bounded(organizer.venueShareBps ?? 0, 0, 10000, "Participación B2B");
  const venueShareClp = Math.round(serviceFeeClp * venueShareBps / 10000);
  return { eventId, ticketTypeId, quantity, currency:"CLP", unitBaseClp:baseClp, faceValueClp, feePerTicketClp, serviceFeeClp, totalClp, venueShareClp, platformShareClp: serviceFeeClp - venueShareClp, note:"Simulación de cobro; sin procesamiento de pagos, impuestos ni recaudación" };
}
export function simulateOrder(store, { eventId, ticketTypeId, quantity, buyerId, idempotencyKey }) {
  // The optional key makes local DEMO retries deterministic; production needs DB uniqueness.
  if (idempotencyKey !== undefined) {
    const key = text(idempotencyKey, 8, 128, "Clave de idempotencia");
    const existing = store.orders.find(o => o.idempotencyKey === key);
    if (existing) {
      if (existing.eventId !== eventId || existing.ticketTypeId !== ticketTypeId ||
          existing.quantity !== Number(quantity) || existing.buyerId !== buyerId) {
        fail("Clave de idempotencia reutilizada con datos diferentes");
      }
      return existing;
    }
  }
  const pricing = quote(store, eventId, ticketTypeId, quantity);
  const event = eventOrFail(store, eventId);
  const order = {
    id: "SIM-" + id().slice(0, 8).toUpperCase(),
    status:"demo_confirmed",
    organizerId:event.organizerId,
    eventId, ticketTypeId,
    quantity:pricing.quantity,
    buyerId:text(buyerId,8,100,"Identificador de comprador autenticado"),
    ...(idempotencyKey !== undefined ? {idempotencyKey} : {}),
    pricing,
    createdAt:iso()
  };
  store.orders.unshift(order);
  store.audit.unshift({id:id(),action:"Compra DEMO simulada",organizerId:event.organizerId,entityId:order.id,at:iso()});
  store.updatedAt=iso();
  return order;
}
export function cancelSimulatedOrder(store, organizerId, orderId) {
  known(store, organizerId);
  const order = store.orders.find((o) => o.id === orderId && o.organizerId === organizerId) || fail("Orden DEMO de otra organización o inexistente");
  if (order.status !== "demo_confirmed") fail("Orden ya anulada");
  order.status = "demo_cancelled";
  store.audit.unshift({id:id(),action:"Orden DEMO anulada",organizerId,entityId:orderId,at:iso()});
  store.updatedAt=iso();
  return order;
}
export function createOrganizerEvent(store, organizationId, input) {
  known(store, organizationId);
  const title = text(input.title,3,90,"Título");
  const venue = text(input.venue,3,100,"Recinto");
  const city = text(input.city,2,50,"Ciudad");
  const date = String(input.date ?? "");
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z")) || new Date(date + "T12:00:00Z").toISOString().slice(0,10) !== date) fail("Fecha inválida");
  const time = String(input.time ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail("Hora inválida");
  const category = String(input.category ?? "");
  if (!["Música","Festivales","Comedia","Teatro","Familia","Experiencias"].includes(category)) fail("Categoría inválida");
  const priceClp=bounded(input.priceClp,0,5000000,"Precio base");
  const capacity=bounded(input.capacity,1,100000,"Aforo");
  const posterUrl=String(input.posterUrl ?? "").trim();
  if (posterUrl) {
    let u;
    try { u = new URL(posterUrl); } catch { fail("URL de cartel inválida"); }
    if (u.protocol !== "https:" || ![".jpg",".jpeg",".png",".webp"].some((ext) => u.pathname.toLowerCase().endsWith(ext))) fail("El cartel debe usar HTTPS y terminar en .jpg, .png o .webp");
    if (input.posterRightsConfirmed !== true) fail("Debes declarar que tienes autorización para publicar el cartel");
  }
  const normalizedDate = new Date(date + "T12:00:00Z");
  const todayUtc = new Date().toISOString().slice(0,10);
  if (date < todayUtc) fail("No se puede publicar un evento DEMO en el pasado");
  const result={
    id:"demo-creado-"+id().slice(0,12),organizerId:organizationId,title,
    subtitle:text(input.subtitle||"Evento publicado por organizador DEMO",3,100,"Subtítulo"),
    category,genre:category,city,venue,date,time,
    description:text(input.description||"Evento de prueba publicado desde el panel de organizador",10,750,"Descripción"),
    accent:/^#[0-9A-Fa-f]{6}$/.test(input.accent||"")?input.accent:"#D2F178",
    visual:"✳",featured:false,status:"published",
    posterUrl:posterUrl||null,posterRights:posterUrl?"declarados_por_usuario_sin_verificar":"demo",
    ticketTypes:[{id:"general",name:"General",priceClp,capacity}]
  };
  store.events.unshift(result);
  store.audit.unshift({id:id(),action:"Evento DEMO publicado",organizerId:organizationId,entityId:result.id,at:iso()});
  store.updatedAt=iso();
  return result;
}
export function statsForOrganizer(store, organizationId) {
  const events = organizerEvents(store,organizationId);
  const orders = ordersForOrganizer(store,organizationId).filter((o) => o.status==="demo_confirmed");
  return {
    events:events.length,
    orders:orders.length,
    ticketsSimulated:orders.reduce((sum,o)=>sum+o.quantity,0),
    grossClp:orders.reduce((sum,o)=>sum+o.pricing.totalClp,0),
    serviceFeeClp:orders.reduce((sum,o)=>sum+o.pricing.serviceFeeClp,0),
    organizerFaceClp:orders.reduce((sum,o)=>sum+o.pricing.faceValueClp,0),
    venueShareClp:orders.reduce((sum,o)=>sum+o.pricing.venueShareClp,0)
  };
}
