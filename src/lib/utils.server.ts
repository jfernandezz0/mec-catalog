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
        search: `MEX_${targetCode}`,
      });

    if (!error && data && data.length > 0) {
      // Filtrar exactamente archivos que coincidan con MEX_ISO.png o MEX_ISO_timestamp.png (insensible a mayúsculas)
      const regex = new RegExp(`^MEX_${targetCode}(_\\d+)?\\.png$`, 'i');
      const matches = data.filter((f) => regex.test(f.name));

      if (matches.length > 0) {
        // Ordenar por fecha de creación descendente (el más reciente primero)
        matches.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (aTime !== bTime) return bTime - aTime;
          // Si no tienen fecha o es igual, ordenar por nombre alfabéticamente descendente (ya que el timestamp en el nombre es numérico)
          return b.name.localeCompare(a.name);
        });

        const latestFile = matches[0].name;
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`logos/${latestFile}`);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error(`Error checking Supabase Storage for country ${code}:`, err);
  }

  // 2. Fallback check in local directory
  try {
    // Intentar primero con MEX_
    const fileNameMEX = `MEX_${targetCode}.png`;
    const filePathMEX = path.join(process.cwd(), 'public', fileNameMEX);
    if (fs.existsSync(filePathMEX)) {
      return `/${fileNameMEX}`;
    }

    // Intentar segundo con MEC_ (compatibilidad anterior)
    const fileNameMEC = `MEC_${targetCode}.png`;
    const filePathMEC = path.join(process.cwd(), 'public', fileNameMEC);
    if (fs.existsSync(filePathMEC)) {
      return `/${fileNameMEC}`;
    }
  } catch (err) {
    console.error(`Error checking local logo file for country ${code}:`, err);
  }

  // Fallback to the mini logo as requested
  return '/logo_mini.png';
}
