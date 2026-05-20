export function getFlagEmoji(countryCode: string): string {
  if (!countryCode) return '🏁';
  
  const code = countryCode.toUpperCase().trim();
  
  // Mapeo heredado para compatibilidad con los códigos de 3 letras existentes
  const legacyMap: Record<string, string> = {
    'ALE': '🇩🇪',
    'JAP': '🇯🇵',
    'ITA': '🇮🇹',
    'USA': '🇺🇸',
    'FRA': '🇫🇷',
    'UK':  '🇬🇧',
    'CRO': '🇭🇷',
    'SUE': '🇸🇪'
  };

  if (legacyMap[code]) {
    return legacyMap[code];
  }

  // Si es un código estándar de 2 letras (ISO 3166-1 alpha-2), convertimos dinámicamente
  if (code.length === 2) {
    const codePoints = code
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      console.error('Error generating flag emoji:', e);
      return '🏁';
    }
  }

  return '🏁';
}

/**
 * Returns the path to the custom MEC country logo for a given country code,
 * or null if no custom logo exists for that code.
 * Files are stored in /public as MEC_<CODE>.png
 */
export function getMECLogo(countryCode: string): string | null {
  if (!countryCode) return null;

  const code = countryCode.toUpperCase().trim();

  // Map country codes to their MEC logo filenames
  const logoMap: Record<string, string> = {
    'ALE': '/MEC_ALE.png',
    'JAP': '/MEC_JP.png',
    'ITA': '/MEC_ITA.png',
    'USA': '/MEC_USA.png',
    'FRA': '/MEC_FR.png',
    'UK':  '/MEC_UK.png',
    'CRO': '/MEC_CRO.png',
    'SUE': '/MEC_SUE.png',
  };

  return logoMap[code] ?? null;
}
