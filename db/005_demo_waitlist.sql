-- PaseListo waiting-room demonstration. Apply to a disposable PostgreSQL database only.
-- No commercial orders or valid tickets are issued. The server alone admits buyers.
BEGIN;
CREATE TABLE IF NOT EXISTS demo_waitlist (
  entry_id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','admitted','used','expired','cancelled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE (event_id,buyer_id)
);
CREATE INDEX IF NOT EXISTS demo_waitlist_fifo
 ON demo_waitlist(event_id,status,joined_at,entry_id);
CREATE INDEX IF NOT EXISTS demo_waitlist_active_expiry
 ON demo_waitlist(event_id,expires_at)
 WHERE status='admitted';
COMMIT;
