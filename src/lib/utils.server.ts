import fs from 'fs';
import path from 'path';

/**
 * Returns the path to the custom MEC country logo for a given country code,
 * or the default fallback /logo_mini.png if no custom logo exists.
 * Files are stored in /public as MEC_<CODE>.png
 */
export function getMECLogo(countryCode: string): string {
  if (!countryCode) return '/logo_mini.png';

  const code = countryCode.toUpperCase().trim();

  // Mapping aliases (e.g. JAP -> JP, FRA -> FR) to standard files
  const aliases: Record<string, string> = {
    'JAP': 'JP',
    'FRA': 'FR',
  };

  const targetCode = aliases[code] ?? code;
  const fileName = `MEC_${targetCode}.png`;

  try {
    const filePath = path.join(process.cwd(), 'public', fileName);
    if (fs.existsSync(filePath)) {
      return `/${fileName}`;
    }
  } catch (err) {
    console.error(`Error checking logo file for country ${code}:`, err);
  }

  // Fallback to the mini logo as requested
  return '/logo_mini.png';
}
