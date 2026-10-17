-- ============================================================
-- MEC Catalog — Migration Phase 0: Payment Integration
-- Run this in Supabase SQL Editor BEFORE deploying code changes
-- ============================================================

-- 0. Update the payment_type check constraint to allow BIZUM + SQUARE
--    (must be done BEFORE the UPDATE below or it will fail)
ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_payment_type_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_payment_type_check
  CHECK (payment_type IN ('BIZUM', 'PAYPAL', 'EFECTIVO', 'RESERVA', 'SQUARE', 'REVOLUT'));

-- 1. Rename REVOLUT → BIZUM in existing sales data
UPDATE sales SET payment_type = 'BIZUM' WHERE payment_type = 'REVOLUT';

-- 2. Add new columns to sales table
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS square_payment_id    TEXT,
  ADD COLUMN IF NOT EXISTS square_order_id      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_name           TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address     JSONB,
  ADD COLUMN IF NOT EXISTS shipping_status      TEXT DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS buyer_user_id        UUID,
  ADD COLUMN IF NOT EXISTS order_number         TEXT,
  ADD COLUMN IF NOT EXISTS receipt_email        TEXT,
  ADD COLUMN IF NOT EXISTS receipt_whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receipt_sent_at      TIMESTAMPTZ;

-- 3. Add new columns to articles table
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS square_catalog_item_id  TEXT,
  ADD COLUMN IF NOT EXISTS reserved_until           TIMESTAMPTZ;

-- 4. Add new settings (Square and Bizum toggles)
INSERT INTO settings (key, value)
VALUES
  ('square_payments_enabled', 'false'),
  ('bizum_enabled',           'true')
ON CONFLICT (key) DO NOTHING;

-- 5. Create cart_sessions table for logged-in users
CREATE TABLE IF NOT EXISTS cart_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,
  session_token TEXT        UNIQUE,
  items         JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ DEFAULT now() + interval '7 days'
);

SELECT 'Migration Phase 0 completed successfully' AS status;
