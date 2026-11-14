-- PaseListo local DEMO: shared throttling of buyer login attempts.
-- Requires 002_demo_buyers_sessions.sql. This is not production abuse protection.
BEGIN;

CREATE TABLE IF NOT EXISTS demo_buyer_login_attempts (
  email TEXT PRIMARY KEY CHECK (length(email) BETWEEN 3 AND 120),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_buyer_login_attempts_reset
  ON demo_buyer_login_attempts (reset_at);

COMMIT;
