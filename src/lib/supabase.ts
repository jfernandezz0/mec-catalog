import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables de entorno de Supabase. Revisa el archivo .env.local");
}

const normalizedSupabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(normalizedSupabaseUrl, supabaseKey);

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

