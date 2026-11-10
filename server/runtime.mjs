import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

const MAX_BODY_BYTES = 32 * 1024;
const encode = (value) => JSON.stringify(value);
const digest = (value) => createHash("sha256").update(value).digest();
const errorStatus = (message) => /inexistente|no encontrado|no disponible/i.test(message) ? 404 :
  /inválid|Texto requerido|requerid|Fecha y hora|Aforo|Capacidad/i.test(message) ? 422 : 409;

async function requestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Solicitud demasiado grande");
      error.status = 413;
      throw error;
    }
  }
  try {
    const data = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data;
  } catch {
    const error = new Error("Se requiere un objeto JSON válido");
    error.status = 400;
    throw error;
  }
}
function credentials(tokens, bearer) {
  const result = /^Bearer ([^\s]{24,256})$/.exec(String(bearer ?? ""));
  if (!result) return null;
  const received = digest(result[1]);
  let tenant = null;
  for (const [id, token] of Object.entries(tokens)) {
    const expected = digest(token);
    if (timingSafeEqual(expected, received)) tenant = id;
  }
  return tenant;
}
function json(response, code, data) {
  response.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(encode(data));
}
function okTokens(tokens) {
  const values = Object.values(tokens || {});
  return values.length >= 2 && new Set(values).size === values.length &&
    values.every((t) => typeof t === "string" && t.length >= 24);
}
export function createDemoApi({ seed, handlers, tokens, filePath, staticRoot }) {
  if (!okTokens(tokens)) throw Error("Configura dos claves DEMO distintas de al menos 24 caracteres; no uses contraseñas reales");
  const resolvedFile = resolve(filePath);
  let state;
  const ready = (async () => {
    try {
      const parsed = JSON.parse(await readFile(resolvedFile, "utf8"));
      if (!Array.isArray(parsed.tenants) || !Array.isArray(parsed.tickets) || !Array.isArray(parsed.audit)) throw Error("Invalid state");
      state = parsed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = seed();
      await persist(state);
    }
  })();
  async function persist(next) {
    await mkdir(dirname(resolvedFile), { recursive: true });
    const staging = resolvedFile + "." + randomUUID() + ".tmp";
    await writeFile(staging, encode(next), { mode: 0o600, flag: "wx" });
    await rename(staging, resolvedFile);
  }
  let serial = Promise.resolve();
  async function mutation(tenant, route, idempotencyKey, payload) {
    const job = serial.then(async () => {
      await ready;
      const fn = handlers.actions[route];
      if (!fn) return { status: 404, result: { error: "Ruta desconocida" } };
      const key = idempotencyKey || "";
      if (key && (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key))) {
        return { status: 400, result: { error: "Idempotency-Key inválida" } };
      }
      const requestDigest = digest(encode(payload)).toString("hex");
      const repeated = key && (state.requests || []).find((x) => x.tenant === tenant && x.key === key && x.route === route);
      if (repeated) return repeated.requestDigest === requestDigest
        ? { status: 200, result: repeated.result }
        : { status: 409, result: { error: "Clave de idempotencia reutilizada con datos distintos" } };
      const next = structuredClone(state);
      const output = fn(next, tenant, payload);
      if (key) {
        next.requests = [...(next.requests || []), { key, tenant, route, requestDigest, result: output }].slice(-2000);
      }
      await persist(next);
      state = next;
      return { status: 201, result: output };
    });
    serial = job.then(() => {}, () => {});
    return job;
  }
  const publicAssets = new Map([
    ["/", ["index.html", "text/html"]],
    ["/index.html", ["index.html", "text/html"]],
    ["/src/styles.css", ["src/styles.css", "text/css"]],
    ["/src/app.mjs", ["src/app.mjs", "text/javascript"]],
    ["/src/domain.mjs", ["src/domain.mjs", "text/javascript"]],
    ["/src/storage.mjs", ["src/storage.mjs", "text/javascript"]],
    ["/src/portal.css", ["src/portal.css", "text/css"]],
    ["/src/commerce.css", ["src/commerce.css", "text/css"]],
    ["/src/marketplace.mjs", ["src/marketplace.mjs", "text/javascript"]],
    ["/src/commerce-domain.mjs", ["src/commerce-domain.mjs", "text/javascript"]],
    ["/src/gestion.mjs", ["src/gestion.mjs", "text/javascript"]],
    ["/src/gestion.css", ["src/gestion.css", "text/css"]],
    ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
    ["/organizador.html", ["organizador.html", "text/html"]],
    ["/data/eventos-clientes-demo.json", ["data/eventos-clientes-demo.json", "application/json"]]
  ]);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    try {
      if (req.method === "GET" && path === "/api/v1/health") {
        json(res, 200, { status: "ok", mode: "demo-local", product: handlers.product });
        return;
      }
      if (!path.startsWith("/api/")) {
        if (req.method !== "GET" || !staticRoot || !publicAssets.has(path)) {
          json(res, 404, { error: "Recurso inexistente" }); return;
        }
        const [file, type] = publicAssets.get(path);
        try {
          const content = await readFile(join(staticRoot, file));
          res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
          res.end(content);
        } catch {
          json(res, 404, { error: "Archivo no disponible" });
        }
        return;
      }
      if (req.method === "GET" && path === "/api/v1/public/events" && typeof handlers.publicEvents === "function") {
        await ready;
        await serial;
        json(res, 200, { events: handlers.publicEvents(state), mode: "demo-local" }); return;
      }
      const tenantId = credentials(tokens, req.headers.authorization);
      if (!tenantId) { json(res, 401, { error: "Token DEMO requerido o inválido" }); return; }
      await ready;
      if (!state.tenants.some((t) => t.id === tenantId)) {
        json(res, 403, { error: "Organización no autorizada" }); return;
      }
      if (req.method === "GET" && path === "/api/v1/snapshot") {
        await serial;
        json(res, 200, handlers.view(state, tenantId));
        return;
      }
      if (req.method === "POST" && path.startsWith("/api/v1/")) {
        const payload = await requestBody(req);
        const value = await mutation(tenantId, path, req.headers["idempotency-key"], payload);
        json(res, value.status, value.result); return;
      }
      json(res, 404, { error: "Ruta desconocida" });
    } catch (error) {
      json(res, error.status || errorStatus(error.message), { error: error.message });
    }
  });
  return { server, ready, filePath: resolvedFile };
}
