-- PaseListo localhost DEMO: shared buyer accounts and revocable sessions.
-- Run AFTER 001_demo_inventory_orders.sql on a disposable PostgreSQL database.
-- No real customer information, production login, email verification, or MFA.
BEGIN;

CREATE TABLE IF NOT EXISTS demo_buyers (
  id TEXT PRIMARY KEY CHECK (id ~ '^buyer-[0-9a-f-]{36}$'),
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 120),
  salt CHAR(32) NOT NULL CHECK (salt ~ '^[0-9a-f]{32}$'),
  digest CHAR(128) NOT NULL CHECK (digest ~ '^[0-9a-f]{128}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_buyer_sessions (
  token_hash CHAR(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  buyer_id TEXT NOT NULL REFERENCES demo_buyers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS demo_buyer_sessions_buyer
  ON demo_buyer_sessions (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS demo_buyer_sessions_expiration
  ON demo_buyer_sessions (expires_at);

COMMIT;
