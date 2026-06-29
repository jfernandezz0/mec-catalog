-- ============================================================
-- MEC Catalog — Migration Phase 1: Square integration
-- Run this in Supabase SQL Editor BEFORE deploying
-- ============================================================

-- 1. RPC function for atomic stock reservation
CREATE OR REPLACE FUNCTION reserve_article_stock(
  p_article_id INT,
  p_minutes INT DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE articles
  SET reserved_until = NOW() + (p_minutes || ' minutes')::INTERVAL
  WHERE id = p_article_id
    AND quantity > 0
    AND (reserved_until IS NULL OR reserved_until < NOW());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 2. Table for pending checkout sessions (webhook needs this to create the sale)
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  square_payment_id TEXT NOT NULL UNIQUE,
  cart_items JSONB NOT NULL,   -- [{articleId, title, priceAtCheckout}]
  buyer JSONB NOT NULL,        -- {name, email, whatsapp, shippingAddress}
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '10 minutes'
);

-- Cleanup old pending checkouts automatically
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_expires_at ON pending_checkouts(expires_at);

-- 3. Add sale_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  article_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- 4. Add order_number to sales if missing
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
