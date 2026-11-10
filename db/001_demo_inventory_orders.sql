-- PaseListo: PostgreSQL transactional storage for the LOCAL DEMO only.
-- Apply to a dedicated disposable database. No payments or valid tickets.
-- Account credentials/sessions still live in the localhost-only JSON demo.
BEGIN;

CREATE TABLE IF NOT EXISTS demo_ticket_stock (
  event_id TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  organizer_id TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0 AND capacity <= 100000),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, ticket_type_id),
  CONSTRAINT demo_stock_cannot_oversell CHECK (sold <= capacity)
);

CREATE TABLE IF NOT EXISTS demo_orders (
  order_id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  request_id VARCHAR(70) NOT NULL,
  event_id TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  organizer_id TEXT NOT NULL,
  quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 6),
  status TEXT NOT NULL DEFAULT 'demo_confirmed'
    CHECK (status IN ('demo_confirmed', 'demo_cancelled')),
  pricing JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (event_id, ticket_type_id)
    REFERENCES demo_ticket_stock (event_id, ticket_type_id),
  CONSTRAINT demo_idempotent_buyer_request UNIQUE (buyer_id, request_id)
);

CREATE INDEX IF NOT EXISTS demo_orders_buyer_history
  ON demo_orders (buyer_id, created_at DESC);

COMMIT;
