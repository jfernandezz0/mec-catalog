-- ============================================================
-- MEC Catalog — Migration Phase 6: Article Visibility
-- Run this in Supabase SQL Editor to support hiding articles from public users
-- ============================================================

-- 1. Add is_visible column to articles table with default true
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- 2. Update any existing null entries to true
UPDATE articles
  SET is_visible = TRUE
  WHERE is_visible IS NULL;

SELECT 'Migration Phase 6 (Article Visibility) completed successfully' AS status;
