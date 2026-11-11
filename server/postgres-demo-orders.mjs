/**
 * Experimental PostgreSQL adapter for PaseListo's local DEMO orders.
 * Provides database-level stock locking and buyer-scoped idempotency.
 * No real sales, payment authorization, production accounts, or valid tickets.
 *
 * Requires db/001_demo_inventory_orders.sql to have been applied beforehand.
 * The supplied pool must implement query() and connect() (node-postgres API).
 */
import { seedCommerce, quote, simulateOrder, eventTicketLimit } from "../src/commerce-domain.mjs";
import { createPostgresDemoWaitlist } from "./postgres-demo-waitlist.mjs";

const bad = (status, message) => Object.assign(new Error(message), { status });
const toOrder = row => ({
  id: row.order_id,
  status: row.status,
  organizerId: row.organizer_id,
  buyerId: row.buyer_id,
  requestId: row.request_id,
  eventId: row.event_id,
  ticketTypeId: row.ticket_type_id,
  quantity: row.quantity,
  pricing: row.pricing,
  createdAt: new Date(row.created_at).toISOString()
});
const SELECT_ORDER = `SELECT order_id, status, organizer_id, buyer_id, request_id,
 event_id, ticket_type_id, quantity, pricing, created_at FROM demo_orders`;

export function createPostgresDemoOrders({ pool, catalog }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") {
    throw Error("Se requiere un pool PostgreSQL compatible");
  }
  const seed = seedCommerce(catalog);
  const published = seed.events.filter(e => e.status === "published");
  const waiting=createPostgresDemoWaitlist({pool,catalog});

  async function initialize() {
    await pool.query("SELECT entry_id FROM demo_waitlist LIMIT 0"); // db/005 required
    // Existing capacity and sold counts must never be reset on server restarts.
    // An explicit migration is required to change an event's capacity.
    for (const event of published) {
      for (const type of event.ticketTypes) {
        await pool.query(
          `INSERT INTO demo_ticket_stock(event_id, ticket_type_id, organizer_id, capacity)
           VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, ticket_type_id) DO NOTHING`,
          [event.id, type.id, event.organizerId, type.capacity]
        );
      }
    }
  }

  async function inventory() {
    const { rows } = await pool.query(
      "SELECT event_id, ticket_type_id, capacity - sold AS remaining FROM demo_ticket_stock"
    );
    const remaining = new Map(rows.map(row => [row.event_id + "|" + row.ticket_type_id, row.remaining]));
    return published.map(event => ({
      eventId: event.id,
      ticketTypes: event.ticketTypes.filter(type => remaining.has(event.id + "|" + type.id)).map(type => {
        const pricing = quote(seed, event.id, type.id, 1, { availabilityRequired: false });
        return {
          ticketTypeId: type.id,
          remaining: remaining.get(event.id + "|" + type.id),
          unitBaseClp: pricing.unitBaseClp,
          feePerTicketClp: pricing.feePerTicketClp
        };
      })
    }));
  }

  async function ordersForBuyer(buyerId) {
    const { rows } = await pool.query(
      SELECT_ORDER + " WHERE buyer_id = $1 ORDER BY created_at DESC, order_id DESC LIMIT 2000",
      [buyerId]
    );
    return rows.map(toOrder);
  }

  async function create({ buyerId, eventId, ticketTypeId, quantity, requestId }) {
    if (typeof buyerId !== "string" || !/^buyer-[0-9a-f-]{36}$/i.test(buyerId)) {
      throw bad(401, "Sesión de comprador inválida");
    }
    if (typeof requestId !== "string" || !/^[a-z0-9-]{12,70}$/i.test(requestId)) {
      throw bad(422, "Identificador de solicitud inválido");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      throw bad(422, "Cantidad fuera de rango");
    }
    const client = await pool.connect();
    let active = false;
    try {
      await client.query("BEGIN");
      active = true;

      // Serializes retries for the same buyer/key even when requests target
      // different events. The stock row lock below protects different keys.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [buyerId + ":" + requestId]);
      const retry = await client.query(
        SELECT_ORDER + " WHERE buyer_id = $1 AND request_id = $2",
        [buyerId, requestId]
      );
      if (retry.rows.length) {
        const existing = toOrder(retry.rows[0]);
        if (existing.eventId !== eventId || existing.ticketTypeId !== ticketTypeId ||
            existing.quantity !== quantity) {
          throw bad(409, "Solicitud repetida con otros datos");
        }
        await client.query("COMMIT");
        active = false;
        return existing;
      }

      const ticketEvent=published.find(event=>event.id===eventId);
      if(!ticketEvent)throw bad(422,"Evento de prueba inexistente");
      const maxPerBuyer=eventTicketLimit(ticketEvent);
      if(quantity>maxPerBuyer)throw bad(409,"Límite máximo de boletos por persona excedido");
      // Serialize *all* orders for this buyer and event, including different
      // ticket categories, to prevent a parallel-request limit bypass.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [buyerId + ":" + eventId + ":buyer-event-limit"]);
      const purchased=await client.query(
        "SELECT COALESCE(SUM(quantity), 0)::int AS total FROM demo_orders WHERE buyer_id=$1 AND event_id=$2 AND status='demo_confirmed'",
        [buyerId,eventId]
      );
      if(Number(purchased.rows[0].total)+quantity>maxPerBuyer)
        throw bad(409,"Límite máximo de boletos por persona excedido");

      // A massive event requires a server-owned admitted FIFO turn. This is
      // checked inside the same transaction as stock and ticket allocation.
      const admission=await waiting.requireAdmission(client,{eventId,buyerId});

      const stock = await client.query(
        `SELECT capacity, sold FROM demo_ticket_stock
         WHERE event_id = $1 AND ticket_type_id = $2 FOR UPDATE`,
        [eventId, ticketTypeId]
      );
      if (!stock.rows.length) throw bad(422, "Evento o tipo de entrada de prueba inexistente");
      if (stock.rows[0].capacity - stock.rows[0].sold < quantity) {
        throw bad(409, "Entradas DEMO insuficientes");
      }

      // A fresh domain store validates price, fees and demo organizer.
      const sandbox = seedCommerce(catalog);
      let order;
      try {
        order = simulateOrder(sandbox, { eventId, ticketTypeId, quantity, buyerId });
      } catch (error) {
        throw bad(422, error.message);
      }
      const modified = await client.query(
        `UPDATE demo_ticket_stock SET sold = sold + $3, updated_at = now()
         WHERE event_id = $1 AND ticket_type_id = $2
         AND sold + $3 <= capacity RETURNING sold`,
        [eventId, ticketTypeId, quantity]
      );
      if (modified.rowCount !== 1) throw bad(409, "Entradas DEMO insuficientes");
      await client.query(
        `INSERT INTO demo_orders
         (order_id, buyer_id, request_id, event_id, ticket_type_id, organizer_id,
          quantity, pricing, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz)`,
        [order.id, buyerId, requestId, eventId, ticketTypeId, order.organizerId,
         quantity, JSON.stringify(order.pricing), order.createdAt]
      );
      await waiting.consumeAdmission(client,admission,eventId);
      await client.query("COMMIT");
      active = false;
      return { ...order, requestId };
    } catch (error) {
      if (active) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return { initialize, inventory, ordersForBuyer, create,
    joinWaitingRoom:waiting.joinWaitingRoom,
    leaveWaitingRoom:waiting.leaveWaitingRoom,
    waitlistStatus:waiting.waitlistStatus };
}
