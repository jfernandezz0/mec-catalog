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
    'SUE': '🇸🇪',
    'ESP': '🇪🇸',
    'KOR': '🇰🇷'
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

