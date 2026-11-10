import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = JSON.parse(await readFile(new URL("../data/eventos-editoriales.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const page = await readFile(new URL("../organizador.html", import.meta.url), "utf8");
const expectedHosts = new Set(["www.puntoticket.com", "cdnp.puntoticket.com", "www.ticketmaster.cl", "dgmedios.com", "www.cirquedusoleil.com", "ticketplus.cl"]);

test("cartelera contiene fuentes oficiales, IDs únicos y fechas válidas", () => {
  assert.ok(source.events.length >= 14);
  assert.equal(new Set(source.events.map((item) => item.id)).size, source.events.length);
  for (const event of source.events) {
    assert.match(event.id, /^[a-z0-9-]+$/);
    assert.ok(event.title.length >= 3);
    assert.match(event.date, /^\d{4}-\d\d-\d\d$/);
    assert.match(event.endDate, /^\d{4}-\d\d-\d\d$/);
    assert.ok(event.endDate >= event.date);
    assert.ok(event.city && event.venue && event.category);
    assert.ok(expectedHosts.has(new URL(event.sourceUrl).hostname), event.title + " requiere fuente primaria");
    assert.ok(["www.puntoticket.com", "www.ticketmaster.cl", "ticketplus.cl"].includes(new URL(event.ticketUrl).hostname), event.title + " debe llevar a venta oficial");
    assert.equal(event.posterStatus, event.posterUrl ? "externo_sin_licencia_verificada" : "pendiente_autorizacion");
    if (event.posterUrl) {
      assert.equal(new URL(event.posterUrl).protocol, "https:");
      assert.equal(new URL(event.posterSourceUrl).protocol, "https:");
      assert.ok(event.posterCredit);
    }
  }
});
test("portal público y panel organizador son páginas independientes", () => {
  assert.match(html, /src\/portal\.mjs/);
  assert.match(html, /id="events-grid"/);
  assert.match(html, /id="detail-backdrop"/);
  assert.match(html, /organizador\.html/);
  assert.doesNotMatch(html, /src\/app\.mjs/);
  assert.match(page, /src\/app\.mjs/);
  assert.doesNotMatch(page, /src\/portal\.mjs/);
});
test("avisa que no vende ni tiene licencia comercial de afiches", () => {
  assert.match(html, /Sin venta de entradas propia/);
  assert.match(html, /No afiliado/);
  assert.match(html, /no procesa pagos/);
  assert.match(html, /autorización para uso comercial está pendiente/);
});
