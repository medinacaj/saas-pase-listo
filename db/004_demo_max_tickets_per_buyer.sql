-- Existing DEMO databases created before configurable order quantities
-- use a CHECK (quantity BETWEEN 1 AND 6). Widen it safely to 100.
-- Existing production databases and real sales are not supported by this demo.
BEGIN;
ALTER TABLE demo_orders DROP CONSTRAINT IF EXISTS demo_orders_quantity_check;
ALTER TABLE demo_orders ADD CONSTRAINT demo_orders_quantity_check
 CHECK (quantity BETWEEN 1 AND 100);
CREATE INDEX IF NOT EXISTS demo_orders_buyer_event_active
 ON demo_orders(buyer_id,event_id) WHERE status='demo_confirmed';
COMMIT;
