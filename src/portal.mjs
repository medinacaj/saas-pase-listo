const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const safeUrl = (url) => {
  try { const u = new URL(url); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
};
const fmt = (date, options) => new Intl.DateTimeFormat("es-CL", options).format(new Date(date + "T12:00:00"));
const shortDate = (date) => fmt(date, { day: "numeric", month: "short" }).replace(".", "").toUpperCase();
const longDate = (date, endDate) => {
  const start = fmt(date, { day: "numeric", month: "long", year: "numeric" });
  if (date === endDate) return start;
  if (date.slice(0, 7) === endDate.slice(0, 7)) return fmt(date, { day: "numeric" }) + " al " + start.replace(/^\d+/, fmt(endDate, { day: "numeric" }));
  return start + " al " + fmt(endDate, { day: "numeric", month: "long", year: "numeric" });
};
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let today = localToday();
const state = { events: [], query: "", category: "Todos", city: "all", period: "all", favoritesOnly: false, detail: null, lastFocus: null };
const KEY = "paselisto:favoritos:v1";
let favoriteIds = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (Array.isArray(stored)) favoriteIds = new Set(stored.filter((id) => typeof id === "string").slice(0, 300));
} catch { /* Private mode: favorites remain for this session. */ }
function persistFavorites() {
  try { localStorage.setItem(KEY, JSON.stringify([...favoriteIds])); } catch { /* Continue in memory. */ }
}
function poster(e, style = "") {
  const img = safeUrl(e.posterUrl);
  const color = /^#[\da-f]{6}$/i.test(e.accent || "") ? e.accent : "#CFF47A";
  return '<div class="poster-frame ' + (img ? "with-image" : "no-image") + '" style="--poster-accent:' + color + ';' + style + '">' +
    '<div class="poster-fallback"><span class="fallback-mark" aria-hidden="true">✳</span><span class="fallback-headline">' + esc(e.title) + '</span><span class="fallback-subline">' + esc(e.subtitle) + '</span><span class="fallback-disclaimer">CARTEL NO DISPONIBLE</span></div>' +
    (img ? '<img class="poster-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' + esc(img) + '" alt="Afiche promocional de ' + esc(e.title) + '. Fuente externa; derechos pendientes de verificación.">' : "") +
    '</div>';
}
function imageReady() {
  $$(".poster-img").forEach((img) => {
    const finish = () => img.closest(".poster-frame")?.classList.toggle("loaded", img.naturalWidth > 0);
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", finish, { once: true });
    if (img.complete) finish();
  });
}
function favoriteButton(e, variant = "") {
  return '<button type="button" class="favorite-button ' + variant + (favoriteIds.has(e.id) ? " selected" : "") + '" data-favorite="' + esc(e.id) + '" aria-label="' +
    (favoriteIds.has(e.id) ? "Quitar " : "Guardar ") + esc(e.title) + ' de favoritos" aria-pressed="' + (favoriteIds.has(e.id) ? "true" : "false") + '">' +
    (favoriteIds.has(e.id) ? "♥" : "♡") + '</button>';
}
function card(e, featured = false) {
  return '<article class="event-card' + (featured ? " feature-card" : "") + '">' +
    '<button type="button" class="poster-button" data-detail="' + esc(e.id) + '" aria-label="Ver ficha de ' + esc(e.title) + '">' +
    poster(e) + '<span class="card-date">' + esc(shortDate(e.date)) + '</span>' +
    '<span class="poster-arrow" aria-hidden="true">↗</span></button>' + favoriteButton(e) +
    '<div class="event-information"><div class="event-taxonomy">' + esc(e.category) + '<span>✳</span>' + esc(e.city) + '</div>' +
    '<button class="event-title-button" type="button" data-detail="' + esc(e.id) + '"><h3>' + esc(e.title) + '</h3></button>' +
    '<p class="event-subtitle">' + esc(e.subtitle) + '</p><div class="event-meta"><span>' + esc(shortDate(e.date)) + '</span><span class="meta-dot">·</span><span>' + esc(e.venue) + '</span></div>' +
    '<div class="event-bottom"><span>Ficha y fuentes</span><button type="button" data-detail="' + esc(e.id) + '" aria-label="Abrir ficha de ' + esc(e.title) + '">↗</button></div></div></article>';
}
function upcomingEvents() {
  return state.events.filter((e) => e.endDate >= today).sort((a, b) => a.date.localeCompare(b.date));
}
function filters() {
  const categories = ["Todos", "Música", "Festivales", "Comedia", "Familia"];
  $("#category-list").innerHTML = categories.map((category) => '<button class="category-chip' + (state.category === category ? " active" : "") + '" type="button" data-category="' + esc(category) + '" aria-pressed="' + (state.category === category) + '">' + esc(category) + '</button>').join("");
  const cities = [...new Set(state.events.map((e) => e.city))].sort((a, b) => a.localeCompare(b, "es"));
  $("#city-filter").innerHTML = '<option value="all">Todas las ciudades</option>' + cities.map((city) => '<option value="' + esc(city) + '">' + esc(city) + '</option>').join("");
  $("#city-filter").value = state.city;
  $("#date-filter").value = state.period;
}
function visibleEvents() {
  const month = today.slice(0, 7);
  const now = new Date(today + "T12:00:00");
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const cutoff = [in30.getFullYear(), String(in30.getMonth() + 1).padStart(2, "0"), String(in30.getDate()).padStart(2, "0")].join("-");
  return upcomingEvents().filter((e) => {
    if (state.favoritesOnly && !favoriteIds.has(e.id)) return false;
    if (state.category !== "Todos" && e.category !== state.category) return false;
    if (state.city !== "all" && e.city !== state.city) return false;
    if (state.period === "month" && e.date.slice(0, 7) !== month) return false;
    if (state.period === "thirty" && e.date > cutoff) return false;
    if (state.period === "later" && e.date <= cutoff) return false;
    return !state.query || normalize([e.title, e.subtitle, e.genre, e.venue, e.city, e.category].join(" ")).includes(normalize(state.query));
  });
}
function renderCatalog() {
  const items = visibleEvents();
  $("#events-grid").innerHTML = items.map((e) => card(e)).join("");
  $("#event-count").textContent = upcomingEvents().length + " eventos en agenda";
  $("#results-description").textContent = items.length === 1 ? "1 evento encontrado" : items.length + " eventos encontrados";
  $("#empty-state").hidden = items.length !== 0;
  const anyFilters = Boolean(state.query || state.category !== "Todos" || state.city !== "all" || state.period !== "all" || state.favoritesOnly);
  $("#clear-filters").hidden = !anyFilters;
  $("#category-list").querySelectorAll("[data-category]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === state.category);
    chip.setAttribute("aria-pressed", String(chip.dataset.category === state.category));
  });
  $("#favorite-count").textContent = favoriteIds.size;
  $("#favorite-count").hidden = favoriteIds.size === 0;
  $("[data-show-favorites]").classList.toggle("is-active", state.favoritesOnly);
  imageReady();
}
function renderFeatured() {
  const picks = upcomingEvents().filter((e) => e.featured).slice(0, 3);
  $("#featured-grid").innerHTML = picks.map((e, index) => card(e, index === 0)).join("");
  if (picks.length) {
    const selected = picks[0];
    $("#hero-poster").innerHTML = '<button class="hero-art-button" data-detail="' + esc(selected.id) + '" aria-label="Conocer ' + esc(selected.title) + '">' +
      poster(selected) + '<span class="hero-poster-bottom"><small>PRÓXIMO DESTACADO</small><strong>' + esc(selected.title) + '<span aria-hidden="true"> ↗</span></strong></span></button>';
  } else {
    $("#hero-poster").innerHTML = '<div class="hero-no-poster"><span>✳</span><strong>Más noches<br>por venir.</strong></div>';
  }
  imageReady();
}
function renderDetail(event) {
  if (!event) return;
  state.detail = event.id;
  const vendor = safeUrl(event.ticketUrl), source = safeUrl(event.sourceUrl), posterSource = safeUrl(event.posterSourceUrl);
  const excerpt = esc(event.editorial);
  $("#detail-content").innerHTML = '<div class="detail-layout"><div class="detail-cover">' + poster(event) +
    '<span class="detail-art-label">' + (event.posterUrl ? "AFICHE PROMOCIONAL · FUENTE EXTERNA" : "CARTEL PENDIENTE") + '</span></div>' +
    '<div class="detail-info"><div class="detail-kicker">' + esc(event.category) + ' <span>✳</span> ' + esc(event.genre) + '</div>' +
    '<h2 id="detail-title">' + esc(event.title) + '</h2><p class="detail-subtitle">' + esc(event.subtitle) + '</p>' +
    '<p class="detail-editorial">' + excerpt + '</p>' +
    '<dl class="event-facts"><div><dt>Fecha</dt><dd>' + esc(longDate(event.date, event.endDate)) + (event.time ? " · " + esc(event.time) + " h" : "") + '</dd></div>' +
    '<div><dt>Lugar</dt><dd>' + esc(event.venue) + ' · ' + esc(event.city) + '</dd></div>' +
    '<div><dt>Entradas</dt><dd>' + esc(event.vendor) + ' (plataforma externa)</dd></div></dl>' +
    '<div class="detail-actions"><a class="official-button" href="' + esc(vendor) + '" target="_blank" rel="noopener noreferrer">Ir a venta oficial <span>↗</span></a>' +
    favoriteButton(event, "detail-fav") + '</div>' +
    '<p class="detail-important">PaseListo no comercializa estas entradas. Disponibilidad, tarifas, condiciones y eventuales cambios deben confirmarse con el vendedor oficial.</p>' +
    '<div class="source-links"><strong>Transparencia de la ficha</strong>' +
    (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Información del organizador o vendedor ↗</a>' : "") +
    (posterSource ? '<a href="' + esc(posterSource) + '" target="_blank" rel="noopener noreferrer">Procedencia del afiche ↗</a>' : "") +
    '<small>' + esc(event.posterCredit || "No se ha incorporado un cartel oficial autorizado") + '. La licencia para uso comercial no está verificada.</small></div>' +
    '</div></div>';
  const shade = $("#detail-backdrop");
  shade.hidden = false;
  document.body.classList.add("dialog-open");
  $("#event-dialog").focus();
  imageReady();
}
function openDetail(id, preserve = false) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return;
  state.lastFocus = document.activeElement;
  renderDetail(event);
  if (!preserve) location.hash = "#evento-" + encodeURIComponent(id);
}
function closeDetail(restore = true) {
  state.detail = null;
  $("#detail-backdrop").hidden = true;
  document.body.classList.remove("dialog-open");
  if (location.hash.startsWith("#evento-")) history.replaceState(null, "", location.pathname + location.search + "#cartelera");
  if (restore && state.lastFocus?.isConnected) state.lastFocus.focus();
}
function checkHash() {
  const hash = decodeURIComponent(location.hash);
  if (hash.startsWith("#evento-")) {
    const id = hash.slice(8);
    if (state.detail !== id) openDetail(id, true);
  } else if (state.detail) closeDetail(false);
}
function clearFilters() {
  state.query = ""; state.city = "all"; state.period = "all"; state.category = "Todos"; state.favoritesOnly = false;
  $("#event-search").value = "";
  $("#city-filter").value = "all"; $("#date-filter").value = "all";
  renderCatalog();
}
function installControls() {
  $("#event-search").addEventListener("input", (e) => { state.query = e.target.value; renderCatalog(); });
  $("#city-filter").addEventListener("change", (e) => { state.city = e.target.value; renderCatalog(); });
  $("#date-filter").addEventListener("change", (e) => { state.period = e.target.value; renderCatalog(); });
  $("#clear-filters").addEventListener("click", clearFilters);
  document.addEventListener("click", (e) => {
    const detail = e.target.closest("[data-detail]");
    if (detail) { openDetail(detail.dataset.detail); return; }
    const favorite = e.target.closest("[data-favorite]");
    if (favorite) {
      if (favoriteIds.has(favorite.dataset.favorite)) favoriteIds.delete(favorite.dataset.favorite);
      else favoriteIds.add(favorite.dataset.favorite);
      persistFavorites();
      renderCatalog(); renderFeatured();
      if (state.detail) renderDetail(state.events.find((item) => item.id === state.detail));
      return;
    }
    const category = e.target.closest("[data-category]");
    if (category) { state.category = category.dataset.category; renderCatalog(); return; }
    if (e.target.closest("[data-show-favorites]")) {
      state.favoritesOnly = !state.favoritesOnly;
      renderCatalog();
      $("#cartelera").scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-close-detail]") || e.target.id === "detail-backdrop") { closeDetail(); return; }
    if (e.target.closest("[data-clear-filters]")) clearFilters();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.detail) { closeDetail(); return; }
    if (e.key === "Tab" && state.detail) {
      const buttons = $$('button:not([disabled]), a[href]', $("#event-dialog")).filter((el) => el.getClientRects().length);
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      e.preventDefault(); $("#event-search").focus(); $("#cartelera").scrollIntoView({ behavior: "smooth" });
    }
  });
  window.addEventListener("hashchange", checkHash);
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { favoriteIds = new Set(JSON.parse(e.newValue || "[]")); } catch { favoriteIds = new Set(); }
    renderCatalog(); renderFeatured();
  });
}
async function boot() {
  installControls();
  try {
    const response = await fetch("./data/eventos-editoriales.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("No se pudo cargar el catálogo");
    const data = await response.json();
    state.events = Array.isArray(data.events) ? data.events.filter((e) => e.id && e.title && e.date && e.endDate && safeUrl(e.sourceUrl) && safeUrl(e.ticketUrl)) : [];
    if (!state.events.length) throw new Error("La cartelera está vacía");
    filters();
    renderFeatured();
    renderCatalog();
    checkHash();
  } catch (err) {
    $("#featured-grid").innerHTML = '<p class="load-error">No fue posible cargar los destacados en este momento.</p>';
    $("#events-grid").innerHTML = '<p class="load-error">La cartelera no está disponible. Intenta recargar la página.</p>';
    $("#event-count").textContent = "Agenda temporalmente no disponible";
    $("#results-description").textContent = "Error de carga";
    console.error("Error de datos públicos:", err.message);
  }
}
boot();
