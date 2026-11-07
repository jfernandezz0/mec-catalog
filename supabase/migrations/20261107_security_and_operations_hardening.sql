-- Migration: 20261107_security_and_operations_hardening.sql
-- 1. Clamp reservation duration and restrict EXECUTE on reserve_article_stock to service_role
-- 2. Add explicit RLS policies on pending_checkouts and cart_sessions

CREATE OR REPLACE FUNCTION public.reserve_article_stock(p_article_id integer, p_minutes integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clamped_minutes integer;
  v_updated integer;
BEGIN
  -- Clamp reservation duration between 1 and 10 minutes to prevent denial-of-service
  v_clamped_minutes := LEAST(GREATEST(COALESCE(p_minutes, 3), 1), 10);

  UPDATE public.articles
  SET reserved_until = NOW() + (v_clamped_minutes || ' minutes')::INTERVAL
  WHERE id = p_article_id
    AND quantity > 0
    AND (reserved_until IS NULL OR reserved_until < NOW());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Restrict execution to service_role and postgres (Next.js server-side API only)
REVOKE EXECUTE ON FUNCTION public.reserve_article_stock(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_article_stock(integer, integer) TO service_role, postgres;

-- Explicit RLS policies for pending_checkouts (accessed via service_role server-side)
DROP POLICY IF EXISTS "Admin only access on pending_checkouts" ON public.pending_checkouts;
CREATE POLICY "Admin only access on pending_checkouts" ON public.pending_checkouts
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);

-- Explicit RLS policies for cart_sessions (accessed via service_role server-side)
DROP POLICY IF EXISTS "Admin only access on cart_sessions" ON public.cart_sessions;
CREATE POLICY "Admin only access on cart_sessions" ON public.cart_sessions
  FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text)
  WITH CHECK (((select auth.jwt()) ->> 'email'::text) = 'minienginescreations@gmail.com'::text);
