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
  const fileName = `MEC_${targetCode}.png`;

  // 1. Check Supabase Storage first to allow dynamic admin overrides
  try {
    const { data, error } = await supabase.storage
      .from('product-images')
      .list('logos', {
        limit: 5,
        search: fileName,
      });

    if (!error && data && data.length > 0) {
      const match = data.find((f) => f.name.toLowerCase() === fileName.toLowerCase());
      if (match) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`logos/${match.name}`);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error(`Error checking Supabase Storage for country ${code}:`, err);
  }

  // 2. Fallback check in local directory
  try {
    const filePath = path.join(process.cwd(), 'public', fileName);
    if (fs.existsSync(filePath)) {
      return `/${fileName}`;
    }
  } catch (err) {
    console.error(`Error checking local logo file for country ${code}:`, err);
  }

  // Fallback to the mini logo as requested
  return '/logo_mini.png';
}
