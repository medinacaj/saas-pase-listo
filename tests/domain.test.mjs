import test from "node:test";
import assert from "node:assert/strict";
import { seedDemo, createEvent, issueTicket, checkIn, cancelTicket, issuedCount, summary, ticketFor } from "../src/domain.mjs";

test("organizaciones no pueden emitir, consultar o validar tickets ajenos", () => {
  const s = seedDemo();
  const t = issueTicket(s, "org-andes", "evt-a1", "Invitado de prueba");
  assert.throws(() => issueTicket(s, "org-oriente", "evt-a1", "Intruso de prueba"), /no encontrado/);
  assert.throws(() => ticketFor(s, "org-oriente", t.code), /inexistente/);
  assert.throws(() => checkIn(s, "org-oriente", t.code), /inexistente/);
  assert.equal(summary(s, "org-oriente").issued, 0);
  assert.equal(summary(s, "org-andes").issued, 1);
});
test("aforo y doble uso se impiden en demo de una sesión", () => {
  const s = seedDemo();
  for (let i = 0; i < 5; i++) issueTicket(s, "org-andes", "evt-a1", "Invitado " + i);
  assert.throws(() => issueTicket(s, "org-andes", "evt-a1", "Invitado Extra"), /Aforo completo/);
  const code = s.tickets[0].code;
  checkIn(s, "org-andes", code);
  assert.throws(() => checkIn(s, "org-andes", code), /utilizada/);
  assert.throws(() => cancelTicket(s, "org-andes", code), /Solo pueden/);
});
test("anular entrada no usada libera aforo y audit conserva tenant", () => {
  const s = seedDemo();
  const t = issueTicket(s, "org-andes", "evt-a1", "Alias temporal");
  cancelTicket(s, "org-andes", t.code);
  assert.equal(issuedCount(s, "org-andes", "evt-a1"), 0);
  assert.equal(summary(s, "org-andes").amountSimulated, 0);
  assert.equal(s.audit.every((a) => a.tenantId === "org-andes"), true);
});
test("validación de aforo, precio, nombre y tenant", () => {
  const s = seedDemo();
  const good = { title: "Evento Uno", venue: "Sala Uno", startsAt: "2027-03-01T18:00", capacity: 2, price: 250 };
  assert.throws(() => createEvent(s, "org-andes", { ...good, capacity: 0 }), /Aforo inválido/);
  assert.throws(() => createEvent(s, "org-andes", { ...good, price: -1 }), /Precio inválido/);
  assert.throws(() => createEvent(s, "no-existe", good), /Organización no disponible/);
  const created = createEvent(s, "org-oriente", good);
  assert.equal(created.tenantId, "org-oriente");
  assert.throws(() => issuedCount(s, "org-andes", created.id), /no encontrado/);
});
