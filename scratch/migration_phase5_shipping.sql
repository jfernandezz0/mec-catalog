-- Phase 5: Add tracking_link to sales table
-- Run this in Supabase SQL Editor

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS tracking_link TEXT;

-- Also ensure shipping_status default is set
ALTER TABLE sales
  ALTER COLUMN shipping_status SET DEFAULT 'PENDIENTE';

-- Update existing rows that have null shipping_status
UPDATE sales
  SET shipping_status = 'PENDIENTE'
  WHERE shipping_status IS NULL;
