// Motor de demostración puro. No contiene autenticación, pasarela, reservas ni persistencia.
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const fail = (message) => { throw new Error(message); };

function tenant(state, tenantId) {
  return state.tenants.find((item) => item.id === tenantId) || fail("Organización no disponible");
}
function eventFor(state, tenantId, eventId) {
  tenant(state, tenantId);
  return state.events.find((item) => item.tenantId === tenantId && item.id === eventId)
    || fail("Evento no encontrado en esta organización");
}
function nonempty(value, max = 90) {
  const text = String(value || "").trim();
  if (text.length < 2 || text.length > max) fail("Introduce un texto de 2 a " + max + " caracteres");
  return text;
}
function record(state, tenantId, action, ref) {
  state.audit.unshift({ id: uid(), tenantId, action, ref, at: now() });
}
export function seedDemo() {
  return {
    tenants: [
      { id: "org-andes", name: "Productora Andes (demo)" },
      { id: "org-oriente", name: "Eventos Oriente (demo)" }
    ],
    events: [
      { id: "evt-a1", tenantId: "org-andes", title: "Encuentro cultural", venue: "Sala Centro", startsAt: "2027-02-12T19:00", capacity: 5, price: 350, currency: "VES" },
      { id: "evt-a2", tenantId: "org-andes", title: "Festival de teatro", venue: "Teatro Central", startsAt: "2027-03-08T18:30", capacity: 12, price: 500, currency: "VES" },
      { id: "evt-b1", tenantId: "org-oriente", title: "Muestra musical", venue: "Auditorio Costero", startsAt: "2027-03-10T20:00", capacity: 8, price: 280, currency: "VES" }
    ],
    tickets: [],
    audit: []
  };
}
export function createEvent(state, tenantId, input) {
  tenant(state, tenantId);
  const capacity = Number(input.capacity);
  const price = Number(input.price);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000) fail("Aforo inválido (1 a 100000)");
  if (!Number.isSafeInteger(price) || price < 0 || price > 100000000) fail("Precio inválido");
  const startsAt = String(input.startsAt || "");
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(startsAt) || Number.isNaN(Date.parse(startsAt))) fail("Fecha y hora inválidas");
  const result = {
    id: uid(), tenantId, title: nonempty(input.title), venue: nonempty(input.venue),
    startsAt, capacity, price, currency: "VES"
  };
  state.events.push(result);
  record(state, tenantId, "Evento creado", result.id);
  return result;
}
export function issuedCount(state, tenantId, eventId) {
  eventFor(state, tenantId, eventId);
  return state.tickets.filter((t) => t.tenantId === tenantId && t.eventId === eventId && t.status !== "cancelled").length;
}
export function issueTicket(state, tenantId, eventId, alias) {
  const event = eventFor(state, tenantId, eventId);
  if (issuedCount(state, tenantId, eventId) >= event.capacity) fail("Aforo completo: no se pueden emitir más entradas");
  const ticket = {
    id: uid(), code: "PL-" + uid().replaceAll("-", "").slice(0, 16).toUpperCase(),
    tenantId, eventId, alias: nonempty(alias, 60), status: "issued",
    price: event.price, currency: event.currency, createdAt: now(), checkedInAt: null
  };
  state.tickets.push(ticket);
  record(state, tenantId, "Entrada DEMO emitida", ticket.id);
  return ticket;
}
export function ticketFor(state, tenantId, code) {
  tenant(state, tenantId);
  const normalized = String(code || "").trim().toUpperCase();
  return state.tickets.find((t) => t.tenantId === tenantId && t.code === normalized)
    || fail("Código inexistente en esta organización");
}
export function checkIn(state, tenantId, code) {
  const ticket = ticketFor(state, tenantId, code);
  if (ticket.status !== "issued") fail("Entrada ya utilizada o anulada");
  ticket.status = "used";
  ticket.checkedInAt = now();
  record(state, tenantId, "Acceso DEMO validado", ticket.id);
  return ticket;
}
export function cancelTicket(state, tenantId, code) {
  const ticket = ticketFor(state, tenantId, code);
  if (ticket.status !== "issued") fail("Solo pueden anularse entradas sin utilizar");
  ticket.status = "cancelled";
  record(state, tenantId, "Entrada DEMO anulada", ticket.id);
  return ticket;
}
export function summary(state, tenantId) {
  tenant(state, tenantId);
  const events = state.events.filter((e) => e.tenantId === tenantId);
  const tickets = state.tickets.filter((t) => t.tenantId === tenantId);
  return {
    events: events.length, issued: tickets.filter((t) => t.status !== "cancelled").length,
    checkedIn: tickets.filter((t) => t.status === "used").length,
    amountSimulated: tickets.filter((t) => t.status !== "cancelled").reduce((sum, t) => sum + t.price, 0)
  };
}
