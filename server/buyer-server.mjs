/**
 * PaseListo buyer auth proof-of-concept, localhost ONLY. Not production authentication.
 * No valid tickets, payments, recovery, deliverability, MFA or real customer data.
 */
import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedCommerce, simulateOrder, available, quote } from "../src/commerce-domain.mjs";
import { createPostgresDemoOrders } from "./postgres-demo-orders.mjs";

const derive = promisify(scrypt);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(await readFile(join(root, "data/eventos-clientes-demo.json"), "utf8"));
const BODY_LIMIT = 4096;
const SESSION_MS = 30 * 60_000;
const bad = (status, message) => Object.assign(new Error(message), { status });
const hashToken = (s) => createHash("sha256").update(s).digest("hex");
const toJson = (res, status, value, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'",
    ...headers
  });
  res.end(JSON.stringify(value));
};
const safeEmail = (s) => {
  const v = String(s ?? "").trim().toLowerCase();
  if (v.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) throw bad(422, "Correo electrónico inválido");
  return v;
};
const safePassword = (p) => {
  if (typeof p !== "string" || p.length < 12 || p.length > 128 || p.includes("\0")) throw bad(422, "La contraseña debe tener entre 12 y 128 caracteres");
  return p;
};
const publicBuyer = (buyer) => ({ id: buyer.id, email: buyer.email });
// Keep organizer and platform revenue splits private. A buyer only needs their own
// simulated ticket price, service fee, and total; never expose the stored ledger.
const buyerOrder = (order) => ({
  id: order.id,
  status: order.status,
  eventId: order.eventId,
  ticketTypeId: order.ticketTypeId,
  quantity: order.quantity,
  createdAt: order.createdAt,
  pricing: {
    currency: order.pricing.currency,
    unitBaseClp: order.pricing.unitBaseClp,
    faceValueClp: order.pricing.faceValueClp,
    feePerTicketClp: order.pricing.feePerTicketClp,
    serviceFeeClp: order.pricing.serviceFeeClp,
    totalClp: order.pricing.totalClp
  }
});
const asBuffer = (value) => Buffer.from(value, "hex");
const calculate = async (password, salt) => await derive(password, asBuffer(salt), 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const bodyFrom = async (req) => {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString("utf8");
    if (Buffer.byteLength(raw) > BODY_LIMIT) throw bad(413, "Solicitud demasiado grande");
  }
  let value;
  try { value = JSON.parse(raw); } catch { throw bad(400, "Se requiere JSON válido"); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw bad(400, "Objeto JSON requerido");
  return value;
};
const activeSession = (req, sessions) => {
  const rawCookie = String(req.headers.cookie || "");
  const match = /(?:^|;\s*)pl_session=([0-9a-f]{64})(?:;|$)/.exec(rawCookie);
  if (!match) return null;
  const key = hashToken(match[1]);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) { sessions.delete(key); return null; }
  return { ...session, key };
};
const cookie = (token, secure = false) => "pl_session=" + (token || "") +
  "; HttpOnly; SameSite=Strict; Path=/; " + (token ? "Max-Age=1800" : "Max-Age=0") + (secure ? "; Secure" : "");
const assetTypes = new Map([
  ["/", ["index.html", "text/html"]], ["/index.html", ["index.html", "text/html"]],
  ["/admin.html", ["admin.html", "text/html"]], ["/organizador.html", ["organizador.html", "text/html"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
  ["/src/marketplace.mjs", ["src/marketplace.mjs", "text/javascript"]],
  ["/src/commerce-domain.mjs", ["src/commerce-domain.mjs", "text/javascript"]],
  ["/src/checkout-state.mjs", ["src/checkout-state.mjs", "text/javascript"]],
  ["/src/portal.css", ["src/portal.css", "text/css"]],
  ["/src/commerce.css", ["src/commerce.css", "text/css"]],
  ["/src/control.mjs", ["src/control.mjs", "text/javascript"]],
  ["/src/control-domain.mjs", ["src/control-domain.mjs", "text/javascript"]],
  ["/src/control.css", ["src/control.css", "text/css"]],
  ["/src/brand-system.css", ["src/brand-system.css", "text/css"]],
  ["/data/eventos-clientes-demo.json", ["data/eventos-clientes-demo.json", "application/json"]],
  ["/data/eventos-reales-referencia.json", ["data/eventos-reales-referencia.json", "application/json"]]
]);
export function buildBuyerServer({ filePath = join(root, ".local", "buyer-demo.json"), ordersBackend = null } = {}) {
  const dbPath = resolve(filePath);
  const sessions = new Map();
  const attempts = new Map();
  let db = null;
  let serial = Promise.resolve();
  const persist = async (value) => {
    await mkdir(dirname(dbPath), { recursive: true });
    const stage = dbPath + "." + randomUUID() + ".tmp";
    await writeFile(stage, JSON.stringify(value), { flag: "wx", mode: 0o600 });
    await rename(stage, dbPath);
  };
  const fileReady = (async () => {
    try {
      const value = JSON.parse(await readFile(dbPath, "utf8"));
      if (value.version !== 1 || !Array.isArray(value.buyers) || !Array.isArray(value.market?.orders)) throw Error("Archivo local de usuarios no válido");
      db = value;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      db = { version: 1, buyers: [], market: seedCommerce(fixture), requests: [] };
      await persist(db);
    }
  })();
  const ready = ordersBackend ? fileReady.then(() => ordersBackend.initialize()) : fileReady;
  const mutate = (work) => {
    const task = serial.then(async () => {
      await ready;
      const next = structuredClone(db);
      const result = await work(next);
      await persist(next);
      db = next;
      return result;
    });
    serial = task.then(() => {}, () => {});
    return task;
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const route = url.pathname;
      const isApi = route.startsWith("/api/buyer/");
      if (!isApi) {
        if (req.method !== "GET" || !assetTypes.has(route)) throw bad(404, "Recurso inexistente");
        const [file, type] = assetTypes.get(route);
        const bytes = await readFile(join(root, file));
        res.writeHead(200, {
          "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https: data:; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"
        });
        res.end(bytes);
        return;
      }
      const path = route.slice("/api/buyer/".length);
      if (req.method === "GET" && path === "status") {
        toJson(res, 200, { ready: true, mode: "local-demo", disclaimer: "Cuentas ficticias; sin ventas reales" });
        return;
      }
      await ready;
      if (req.method === "GET" && path === "session") {
        const session = activeSession(req, sessions);
        const buyer = session ? db.buyers.find(u => u.id === session.buyerId) : null;
        toJson(res, 200, buyer ? { authenticated: true, buyer: publicBuyer(buyer) } : { authenticated: false });
        return;
      }
      if (req.method === "GET" && path === "inventory") {
        const events = ordersBackend
          ? await ordersBackend.inventory()
          : db.market.events.filter(e => e.status === "published").map(e => ({
              eventId: e.id,
              ticketTypes: e.ticketTypes.map(t => {
                const preview = quote(db.market, e.id, t.id, 1, { availabilityRequired: false });
                return {
                  ticketTypeId: t.id,
                  remaining: available(db.market, e.id, t.id),
                  unitBaseClp: preview.unitBaseClp,
                  feePerTicketClp: preview.feePerTicketClp
                };
              })
            }));
        toJson(res, 200, { events, updatedAt: ordersBackend ? null : db.market.updatedAt });
        return;
      }
      if (req.method === "GET" && path === "orders") {
        const session = activeSession(req, sessions);
        if (!session || !db.buyers.some(b => b.id === session.buyerId)) throw bad(401, "Debes iniciar sesión para consultar pedidos");
        const source = ordersBackend
          ? await ordersBackend.ordersForBuyer(session.buyerId)
          : db.market.orders.filter(o => o.buyerId === session.buyerId);
        const orders = source.map(buyerOrder);
        toJson(res, 200, { orders });
        return;
      }
      if (req.method !== "POST") throw bad(404, "Ruta desconocida");
      // Same-origin, custom-header requests only. Cookies alone must never authorize a form POST.
      // Only accept browser POSTs with an explicit same-origin Origin header.
      // Never trust an arbitrary Host header for CSRF validation.
      const host = String(req.headers.host || "");
      const localHost = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host);
      const expectedOrigin = "http://" + host;
      if (!localHost || req.headers["x-paselisto-request"] !== "1" ||
          req.headers.origin !== expectedOrigin) throw bad(403, "Origen de solicitud no autorizado");
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) throw bad(415, "Contenido JSON requerido");
      const payload = await bodyFrom(req);
      if (path === "register") {
        const email = safeEmail(payload.email), password = safePassword(payload.password);
        const salt = randomBytes(16).toString("hex");
        const digest = (await calculate(password, salt)).toString("hex");
        const result = await mutate(async (next) => {
          if (next.buyers.some(b => b.email === email)) throw bad(409, "La cuenta ya existe en esta demo");
          if (next.buyers.length >= 100) throw bad(429, "Límite de cuentas de prueba alcanzado");
          const buyer = { id: "buyer-" + randomUUID(), email, salt, digest, createdAt: new Date().toISOString() };
          next.buyers.push(buyer);
          return publicBuyer(buyer);
        });
        const token = randomBytes(32).toString("hex");
        sessions.set(hashToken(token), { buyerId: result.id, expiresAt: Date.now() + SESSION_MS });
        toJson(res, 201, { authenticated: true, buyer: result }, { "Set-Cookie": cookie(token) });
        return;
      }
      if (path === "login") {
        const email = safeEmail(payload.email), password = safePassword(payload.password);
        const attempt = attempts.get(email) || { count: 0, resetAt: Date.now() + 10 * 60_000 };
        if (attempt.resetAt < Date.now()) { attempt.count = 0; attempt.resetAt = Date.now() + 10 * 60_000; }
        if (attempt.count >= 8) throw bad(429, "Demasiados intentos. Vuelve a probar más adelante");
        await serial;
        const buyer = db.buyers.find(b => b.email === email);
        // A dummy derivation prevents the obvious fast path for an unknown account.
        const salt = buyer?.salt || randomBytes(16).toString("hex");
        const computed = await calculate(password, salt);
        const stored = buyer ? asBuffer(buyer.digest) : randomBytes(64);
        if (!buyer || !timingSafeEqual(computed, stored)) {
          attempt.count++;
          attempts.set(email, attempt);
          if (attempts.size > 1000) attempts.clear();
          throw bad(401, "Correo o contraseña incorrectos");
        }
        attempts.delete(email);
        const token = randomBytes(32).toString("hex");
        sessions.set(hashToken(token), { buyerId: buyer.id, expiresAt: Date.now() + SESSION_MS });
        toJson(res, 200, { authenticated: true, buyer: publicBuyer(buyer) }, { "Set-Cookie": cookie(token) });
        return;
      }
      const session = activeSession(req, sessions);
      if (!session || !db.buyers.some(b => b.id === session.buyerId)) throw bad(401, "Debes iniciar sesión para comprar");
      if (path === "logout") {
        sessions.delete(session.key);
        toJson(res, 200, { authenticated: false }, { "Set-Cookie": cookie("") });
        return;
      }
      if (path === "orders") {
        const requestId = String(payload.requestId || "");
        if (!/^[a-z0-9-]{12,70}$/i.test(requestId)) throw bad(422, "Identificador de solicitud inválido");
        const order = ordersBackend
          ? await ordersBackend.create({
              buyerId: session.buyerId, eventId: payload.eventId,
              ticketTypeId: payload.ticketTypeId, quantity: payload.quantity, requestId
            })
          : await mutate(async next => {
              const existing = next.market.orders.find(o => o.buyerId === session.buyerId && o.requestId === requestId);
              if (existing) {
                if (existing.eventId !== payload.eventId || existing.ticketTypeId !== payload.ticketTypeId || existing.quantity !== payload.quantity) throw bad(409, "Solicitud repetida con otros datos");
                return existing;
              }
              if (next.market.orders.length >= 2000) throw bad(429, "Límite de pedidos de demostración alcanzado");
              const created = simulateOrder(next.market, { eventId: payload.eventId, ticketTypeId: payload.ticketTypeId, quantity: payload.quantity, buyerId: session.buyerId });
              created.requestId = requestId;
              return created;
            });
        toJson(res, 201, buyerOrder(order));
        return;
      }
      throw bad(404, "Ruta desconocida");
    } catch (err) {
      // Avoid leaking file paths, crypto details or internal errors in HTTP responses.
      const status = Number.isInteger(err.status) ? err.status : (/insuficientes|no está publicado/.test(err.message) ? 409 : 500);
      toJson(res, status, { error: status === 500 ? "Error interno del servidor de demostración" : err.message });
    }
  });
  return { server, ready, filePath: dbPath };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Optional PostgreSQL DEMO mode. Requires a dedicated database with the
  // migration applied; never point this server at production customer data.
  let pool = null;
  let ordersBackend = null;
  if (process.env.PASELISTO_DEMO_DATABASE_URL) {
    const { Pool } = (await import("pg")).default;
    pool = new Pool({ connectionString: process.env.PASELISTO_DEMO_DATABASE_URL, max: 8 });
    ordersBackend = createPostgresDemoOrders({ pool, catalog: fixture });
  }
  const app = buildBuyerServer({ ordersBackend });
  app.ready.then(() => app.server.listen(8082, "127.0.0.1", () => console.log(
    "PaseListo DEMO local (" + (ordersBackend ? "PostgreSQL" : "JSON") + "): http://127.0.0.1:8082"
  ))).catch(async err => {
    console.error("No se pudo iniciar servidor local de prueba:", err.message);
    await pool?.end();
    process.exit(1);
  });
}
