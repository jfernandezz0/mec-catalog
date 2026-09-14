-- ============================================================
-- MEC Catalog — Migration Phase 7: Expenses & Financial Balance
-- Run this in Supabase SQL Editor to support expense tracking and balance
-- ============================================================

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'OTROS',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast analytics and date filtering
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies allowing full access
DROP POLICY IF EXISTS "Allow full access to expenses" ON expenses;
CREATE POLICY "Allow full access to expenses"
  ON expenses
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT 'Migration Phase 7 (Expenses & Balance) completed successfully' AS status;
