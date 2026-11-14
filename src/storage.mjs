// Persistencia exclusiva para una demostración sin datos reales.
const PREFIX = "ticketing-demo:v2:";
const MAX_CHARS = 250000;
const supported = (value) => value && typeof value === "object" &&
  ["tenants", "tickets", "audit"].every((key) => Array.isArray(value[key]));

export function loadDemo(product, seed) {
  try {
    if (typeof localStorage === "undefined") return seed();
    const raw = localStorage.getItem(PREFIX + product);
    if (!raw || raw.length > MAX_CHARS) return seed();
    const parsed = JSON.parse(raw);
    return supported(parsed) && Array.isArray(parsed.events ?? parsed.trips) &&
      (product === "paselisto" || Array.isArray(parsed.cash)) ? parsed : seed();
  } catch {
    return seed();
  }
}
export function saveDemo(product, state) {
  try {
    if (typeof localStorage === "undefined") return false;
    const raw = JSON.stringify(state);
    if (raw.length > MAX_CHARS) return false;
    localStorage.setItem(PREFIX + product, raw);
    return true;
  } catch {
    return false;
  }
}
export function clearDemo(product) {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PREFIX + product);
  } catch {
    // Almacenamiento privado o deshabilitado: la demo sigue en memoria.
  }
}
