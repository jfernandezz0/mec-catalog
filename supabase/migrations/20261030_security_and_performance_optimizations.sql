-- Migration: 20261030_security_and_performance_optimizations.sql
-- Optimizations for RLS policies, foreign key indexes, and function execution security.

-- 1. Create missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_articles_category_id ON public.articles(category_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_article_id ON public.sale_items(article_id);

-- 2. Revoke public/anon execute on sensitive security definer functions
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_article_stock(bigint, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_article_stock(bigint, integer) TO service_role;

-- 3. Deduplicate SELECT policies on articles
DROP POLICY IF EXISTS "Allow public read access on articles" ON public.articles;
DROP POLICY IF EXISTS "Allow public read articles" ON public.articles;

-- 4. Deduplicate SELECT policies on categories
DROP POLICY IF EXISTS "Allow public read access on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public read categories" ON public.categories;

-- 5. Optimize RLS Initplan for admin policies (subquery (select auth.jwt()) prevents per-row evaluation)
DROP POLICY IF EXISTS "Allow write for admin only" ON public.articles;
CREATE POLICY "Allow write for admin only" ON public.articles
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Allow write for admin only" ON public.categories;
CREATE POLICY "Allow write for admin only" ON public.categories
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Allow write for admin only" ON public.settings;
CREATE POLICY "Allow write for admin only" ON public.settings
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Allow write for admin only" ON public.sales;
CREATE POLICY "Allow write for admin only" ON public.sales
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Allow write for admin only" ON public.sale_items;
CREATE POLICY "Allow write for admin only" ON public.sale_items
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Allow write for admin only" ON public.stats_snapshots;
CREATE POLICY "Allow write for admin only" ON public.stats_snapshots
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

DROP POLICY IF EXISTS "Admin full access to expenses" ON public.expenses;
CREATE POLICY "Admin full access to expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);
