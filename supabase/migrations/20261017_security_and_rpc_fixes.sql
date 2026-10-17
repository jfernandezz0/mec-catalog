-- ============================================================================
-- Migration: Security Hardening, Storage RLS, Expenses Grants & Atomic Stock RPC
-- ============================================================================

-- 1. Create atomic decrement_article_stock RPC function
CREATE OR REPLACE FUNCTION public.decrement_article_stock(
  p_article_id BIGINT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.articles
  SET
    quantity = GREATEST(0, quantity - p_quantity),
    reserved_until = NULL
  WHERE id = p_article_id
    AND quantity >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_article_stock(BIGINT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_article_stock(BIGINT, INTEGER) TO authenticated, service_role;

-- 2. Lock down public table privileges for anonymous role
REVOKE TRUNCATE, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 3. Fix expenses table grants and RLS policy (Admin-only instead of USING (true))
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated, service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admin full access to expenses" ON public.expenses;

CREATE POLICY "Admin full access to expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'minienginescreations@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'minienginescreations@gmail.com');

-- 4. Lock down storage.objects policies on product-images bucket
DROP POLICY IF EXISTS "Allow public upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida a cualquiera" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de logos a usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Admin write access product-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access product-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access product-images" ON storage.objects;

CREATE POLICY "Admin write access product-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.jwt() ->> 'email') = 'minienginescreations@gmail.com'
  );

CREATE POLICY "Admin update access product-images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (auth.jwt() ->> 'email') = 'minienginescreations@gmail.com'
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.jwt() ->> 'email') = 'minienginescreations@gmail.com'
  );

CREATE POLICY "Admin delete access product-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (auth.jwt() ->> 'email') = 'minienginescreations@gmail.com'
  );

-- 5. Harden SECURITY DEFINER analytics RPC functions with explicit search_path
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('increment_article_views', 'increment_contact_clicks', 'increment_share_clicks', 'reserve_article_stock')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END;
$$;
