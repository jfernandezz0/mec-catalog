import fs from 'fs';
import path from 'path';
import { supabase } from './supabase';

/**
 * Returns the path to the custom MEC country logo for a given country code,
 * or the default fallback /logo_mini.png if no custom logo exists.
 * Files are checked first locally in public, and if not found, in Supabase Storage.
 */
export async function getMECLogo(countryCode: string): Promise<string> {
  if (!countryCode) return '/logo_mini.png';

  const code = countryCode.toUpperCase().trim();

  // Mapping aliases (e.g. JAP -> JP, FRA -> FR) to standard files
  const aliases: Record<string, string> = {
    'JAP': 'JP',
    'FRA': 'FR',
    'ESP': 'ES',
    'KOR': 'KR',
  };

  const targetCode = aliases[code] ?? code;
  const fileNameWebP = `MEC_${targetCode}.webp`;
  const fileNamePng = `MEC_${targetCode}.png`;

  // 1. Check Supabase Storage first to allow dynamic admin overrides
  try {
    const { data, error } = await supabase.storage
      .from('product-images')
      .list('logos', {
        limit: 10,
        search: `MEC_${targetCode}`,
      });

    if (!error && data && data.length > 0) {
      const matchWebP = data.find((f) => f.name.toLowerCase() === fileNameWebP.toLowerCase());
      if (matchWebP) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`logos/${matchWebP.name}`);
        return urlData.publicUrl;
      }
      const matchPng = data.find((f) => f.name.toLowerCase() === fileNamePng.toLowerCase());
      if (matchPng) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`logos/${matchPng.name}`);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error(`Error checking Supabase Storage for country ${code}:`, err);
  }

  // 2. Fallback check in local directory
  try {
    const filePathWebP = path.join(process.cwd(), 'public', fileNameWebP);
    if (fs.existsSync(filePathWebP)) {
      return `/${fileNameWebP}`;
    }
    const filePathPng = path.join(process.cwd(), 'public', fileNamePng);
    if (fs.existsSync(filePathPng)) {
      return `/${fileNamePng}`;
    }
  } catch (err) {
    console.error(`Error checking local logo file for country ${code}:`, err);
  }

  // Fallback to the mini logo as requested
  return '/logo_mini.png';
}

import type { NextRequest } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'minienginescreations@gmail.com';

export interface VerifyAdminResult {
  authorized: boolean;
  user?: User;
  error?: string;
  statusCode?: number;
}

/**
 * Unified verification for administrative server routes.
 * Inspects both Authorization: Bearer <token> and sb-session cookie,
 * verifies the token with Supabase Auth, and enforces admin email matching.
 */
export async function verifyAdminSession(request: NextRequest): Promise<VerifyAdminResult> {
  let token: string | null = null;
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    token = request.cookies.get('sb-session')?.value?.trim() || null;
  }

  if (!token) {
    return {
      authorized: false,
      error: 'No autorizado. Debes iniciar sesión como administrador.',
      statusCode: 401,
    };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await client.auth.getUser(token);

    if (authError || !user) {
      return {
        authorized: false,
        error: 'Sesión no válida o expirada. Por favor, inicia sesión de nuevo.',
        statusCode: 401,
      };
    }

    if (user.email !== ADMIN_EMAIL) {
      return {
        authorized: false,
        error: 'Acceso denegado. No tienes permisos de administrador.',
        statusCode: 403,
      };
    }

    return {
      authorized: true,
      user,
    };
  } catch (err: any) {
    console.error('[verifyAdminSession] Error validating session:', err);
    return {
      authorized: false,
      error: 'Error al verificar la sesión de administrador.',
      statusCode: 500,
    };
  }
}

