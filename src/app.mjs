import { seedDemo, createEvent, issueTicket, checkIn, cancelTicket, issuedCount, summary } from "./domain.mjs";

const state = seedDemo();
let tenantId = state.tenants[0].id;
let currentEvent = "evt-a1";
let message = "";
let error = false;
const app = document.querySelector("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const money = (n) => new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES", maximumFractionDigits: 0 }).format(n);
const humanDate = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" }).format(d); };
function feedback(text, isError = false) { message = text; error = isError; render(); }
function run(action, success) {
  try { action(); feedback(success); }
  catch (e) { feedback(e.message, true); }
}
function render() {
  const events = state.events.filter((e) => e.tenantId === tenantId);
  if (!events.some((e) => e.id === currentEvent)) currentEvent = events[0]?.id || "";
  const selected = events.find((e) => e.id === currentEvent);
  const tickets = state.tickets.filter((t) => t.tenantId === tenantId && t.eventId === currentEvent);
  const kpis = summary(state, tenantId);
  const logs = state.audit.filter((a) => a.tenantId === tenantId).slice(0, 5);
  app.innerHTML =
    '<div class="shell"><aside class="sidebar"><a class="brand" href="#contenido"><span class="brand-icon">P</span><span>Pase<span class="brand-accent">Listo</span><small>Organización de eventos</small></span></a>' +
    '<div class="side-label">ESPACIO DEMOSTRATIVO</div><label for="tenant">Organización</label><select id="tenant" class="field">' +
    state.tenants.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === tenantId ? " selected" : "") + '>' + esc(o.name) + '</option>').join("") +
    '</select><nav aria-label="Secciones"><a class="nav-active" href="#contenido">Vista general</a><a href="#eventos">Eventos</a><a href="#entradas">Entradas y acceso</a><a href="#actividad">Actividad</a></nav>' +
    '<div class="side-note">Cada organización tiene sus propios datos ficticios. Este selector no es autenticación SaaS.</div></aside>' +
    '<main id="contenido" class="main"><div class="top"><div><p class="eyebrow">PANEL DEL ORGANIZADOR</p><h1>Control de eventos</h1><p class="subtitle">Organiza, emite entradas de prueba y valida accesos.</p></div><div class="top-chip">Versión 0.1 · demo</div></div>' +
    '<div class="warning" role="note"><strong>Entorno demostrativo</strong> · Datos sintéticos en memoria. Sin venta, pago, QR firmado ni reserva real. Al recargar se restablece todo.</div>' +
    (message ? '<p class="' + (error ? "notice error" : "notice") + '" role="status">' + esc(message) + '</p>' : "") +
    '<section class="metrics" aria-label="Indicadores"><article><span>Eventos</span><strong>' + kpis.events + '</strong><small>De esta organización</small></article>' +
    '<article><span>Entradas emitidas</span><strong>' + kpis.issued + '</strong><small>Sin contar anuladas</small></article>' +
    '<article><span>Accesos validados</span><strong>' + kpis.checkedIn + '</strong><small>Solo simulación</small></article>' +
    '<article><span>Importe referencial</span><strong>' + money(kpis.amountSimulated) + '</strong><small>No representa dinero cobrado</small></article></section>' +
    '<div class="columns"><section class="panel" id="eventos"><div class="panel-head"><div><h2>Mis eventos</h2><p>Elige un evento para gestionar su inventario.</p></div></div>' +
    '<div class="event-list">' + events.map((e) => '<button class="event' + (e.id === currentEvent ? " selected" : "") + '" type="button" data-event="' + esc(e.id) + '"><span class="event-title">' + esc(e.title) + '</span><span class="muted">' + esc(e.venue) + ' · ' + esc(humanDate(e.startsAt)) + '</span><span class="event-foot">' + issuedCount(state, tenantId, e.id) + ' / ' + e.capacity + ' entradas · ' + money(e.price) + '</span></button>').join("") + '</div>' +
    '<details><summary>Crear evento de prueba</summary><form id="new-event" class="form-grid"><label>Nombre<input required name="title" maxlength="90" minlength="2" placeholder="Ej.: Festival cultural"></label><label>Lugar<input required name="venue" maxlength="90" minlength="2" placeholder="Ej.: Teatro Central"></label><label>Fecha y hora<input required name="startsAt" type="datetime-local"></label><div class="form-pair"><label>Aforo<input required name="capacity" type="number" min="1" max="100000" value="50"></label><label>Precio referencial VES<input required name="price" type="number" min="0" step="1" value="100"></label></div><button class="btn" type="submit">Crear evento</button></form></details></section>' +
    '<section class="panel" id="entradas"><div class="panel-head"><div><h2>Entradas y accesos</h2><p>' + (selected ? esc(selected.title) : "Selecciona un evento") + '</p></div><span class="pill">' + (selected ? esc(issuedCount(state, tenantId, selected.id) + "/" + selected.capacity) : "—") + '</span></div>' +
    (selected ? '<form id="new-ticket" class="form-inline"><label>Alias de comprador de prueba<input required name="alias" minlength="2" maxlength="60" placeholder="Ej.: Invitado Demo"></label><button class="btn" type="submit">Emitir entrada demo</button></form>' : '<p>Crea un evento para emitir entradas.</p>') +
    '<form id="access" class="form-inline access"><label>Validar código de entrada<input required name="code" placeholder="PL-..." autocomplete="off"></label><button class="btn secondary" type="submit">Validar acceso</button></form>' +
    '<div class="table-wrap"><table><thead><tr><th>Alias</th><th>Código</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' +
    (tickets.length ? tickets.slice().reverse().map((t) => '<tr><td>' + esc(t.alias) + '</td><td><code>' + esc(t.code) + '</code></td><td><span class="tag ' + esc(t.status) + '">' + (t.status === "issued" ? "Emitida" : t.status === "used" ? "Utilizada" : "Anulada") + '</span></td><td>' + (t.status === "issued" ? '<button type="button" class="link-btn" data-cancel="' + esc(t.code) + '">Anular</button>' : "—") + '</td></tr>').join("") : '<tr><td colspan="4" class="empty">Sin entradas de prueba</td></tr>') + '</tbody></table></div></section></div>' +
    '<section class="panel activity" id="actividad"><h2>Actividad reciente</h2>' +
    (logs.length ? '<ul class="audit">' + logs.map((a) => '<li><span>' + esc(a.action) + '</span><time>' + esc(humanDate(a.at)) + '</time></li>').join("") + '</ul>' : '<p class="muted">Sin actividad registrada en esta sesión.</p>') +
    '</section><footer>© PaseListo · Primera etapa · No es una plataforma comercial habilitada.</footer></main></div>';
}
app.addEventListener("change", (ev) => {
  if (ev.target.id === "tenant") { tenantId = ev.target.value; currentEvent = ""; feedback("Cambiaste de organización demostrativa."); }
});
app.addEventListener("click", (ev) => {
  const eventButton = ev.target.closest("[data-event]");
  const cancelButton = ev.target.closest("[data-cancel]");
  if (eventButton) { currentEvent = eventButton.dataset.event; message = ""; render(); }
  if (cancelButton && confirm("¿Anular esta entrada de demostración?")) run(() => cancelTicket(state, tenantId, cancelButton.dataset.cancel), "Entrada de prueba anulada.");
});
app.addEventListener("submit", (ev) => {
  if (!["new-event", "new-ticket", "access"].includes(ev.target.id)) return;
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(ev.target).entries());
  if (ev.target.id === "new-event") run(() => { currentEvent = createEvent(state, tenantId, data).id; }, "Evento de prueba creado.");
  if (ev.target.id === "new-ticket") run(() => issueTicket(state, tenantId, currentEvent, data.alias), "Entrada de prueba emitida (no existe pago real).");
  if (ev.target.id === "access") run(() => checkIn(state, tenantId, data.code), "Entrada de prueba validada. Un segundo uso será rechazado.");
});
render();
