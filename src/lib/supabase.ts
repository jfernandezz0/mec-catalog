import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables de entorno de Supabase. Revisa el archivo .env.local");
}

const normalizedSupabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(normalizedSupabaseUrl, supabaseKey);
