import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createDemoApi } from "./runtime.mjs";
import { seedDemo, createEvent, issueTicket, checkIn, cancelTicket, summary } from "../src/domain.mjs";

const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function buildServer({ tokens, filePath = resolve(staticRoot, ".local", "paselisto.json") }) {
  return createDemoApi({
    seed: seedDemo, tokens, filePath, staticRoot,
    handlers: {
      product: "PaseListo",
      view: (s, id) => ({
        organization: s.tenants.find((t) => t.id === id),
        events: s.events.filter((e) => e.tenantId === id),
        tickets: s.tickets.filter((t) => t.tenantId === id),
        audit: s.audit.filter((a) => a.tenantId === id).slice(0, 50),
        summary: summary(s, id)
      }),
      actions: {
        "/api/v1/events": (s, id, p) => createEvent(s, id, p),
        "/api/v1/tickets": (s, id, p) => issueTicket(s, id, p.eventId, p.alias),
        "/api/v1/checkins": (s, id, p) => checkIn(s, id, p.code),
        "/api/v1/cancellations": (s, id, p) => cancelTicket(s, id, p.code)
      }
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let tokens;
  try { tokens = JSON.parse(process.env.TICKETING_DEMO_KEYS || "{}"); }
  catch { console.error("TICKETING_DEMO_KEYS debe ser un objeto JSON"); process.exit(1); }
  try {
    const { server, ready } = buildServer({ tokens });
    ready.then(() => server.listen(8080, "127.0.0.1", () =>
      console.log("Servidor DEMO PaseListo (solo local) en http://127.0.0.1:8080")
    )).catch((err) => { console.error(err.message); process.exit(1); });
  } catch (err) { console.error(err.message); process.exit(1); }
}
