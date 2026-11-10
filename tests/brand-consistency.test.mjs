import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("portal y centro de control comparten sistema de marca", async () => {
  const [portal, control, css] = await Promise.all([
    read("index.html"), read("admin.html"), read("src/brand-system.css")
  ]);
  for (const [page, html] of [["portal", portal], ["control", control]]) {
    assert.match(html, /src\/brand-system\.css/, page + " debe cargar estilos compartidos");
    assert.ok(html.indexOf("brand-system.css") > html.indexOf("src/"), "la hoja compartida debe ir después de los estilos base");
  }
  for (const token of ["--pl-ink", "--pl-cream", "--pl-lime", "--pl-sans", "--pl-display"]) {
    assert.ok(css.includes(token), "falta token " + token);
  }
});
