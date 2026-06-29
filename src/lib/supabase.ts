import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables de entorno de Supabase. Revisa el archivo .env.local");
}

const normalizedSupabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

/** Public client — uses anon key, respects RLS. Use in client components and read-only server routes. */
export const supabase = createClient(normalizedSupabaseUrl, supabaseKey);

/**
 * Admin client — uses service_role key, bypasses RLS.
 * Only use in server-side API routes that need write access (payments, stock, orders).
 * Never expose this client to the browser.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Required for server-side write operations.');
  }
  return createClient(normalizedSupabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    const cookieName = 'sb-session';
    if (session) {
      document.cookie = `${cookieName}=${session.access_token};path=/;max-age=31536000;SameSite=Lax;Secure`;
    } else {
      document.cookie = `${cookieName}=;path=/;max-age=0;SameSite=Lax;Secure`;
    }
  });
}
