export const VALID_ISO_CODES = new Set([
  // Standard Alpha-2
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
  // Standard Alpha-3
  'AND', 'ARE', 'AFG', 'ATG', 'AZE', 'ALB', 'ARM', 'AGO', 'ARG', 'AUT', 'AUS', 'BGD', 'BEL', 'BFA',
  'BGR', 'BHR', 'BDI', 'BEN', 'BOL', 'BRA', 'BHS', 'BTN', 'BWA', 'BLR', 'BLZ', 'CAN', 'COD', 'CAF',
  'COG', 'CHE', 'CIV', 'CHL', 'CMR', 'CHN', 'COL', 'CRI', 'CUB', 'CYP', 'CZE', 'DEU', 'DJI', 'DNK',
  'DOM', 'DZA', 'ECU', 'EGY', 'ERI', 'ESP', 'EST', 'ETH', 'FIN', 'FJI', 'FRA', 'GAB', 'GBR', 'GEO',
  'GHA', 'GIN', 'GNQ', 'GRC', 'GTM', 'HND', 'HRV', 'HTI', 'HUN', 'IDN', 'IND', 'IRL', 'IRN', 'IRQ',
  'ISL', 'ISR', 'ITA', 'JAM', 'JOR', 'JPN', 'KAZ', 'KEN', 'KGZ', 'KHM', 'KOR', 'KWT', 'LBN', 'LBR',
  'LBY', 'LIE', 'LKA', 'LSO', 'LTU', 'LUX', 'LVA', 'MAR', 'MCO', 'MDA', 'MDG', 'MEX', 'MKD', 'MLI',
  'MLT', 'MMR', 'MNE', 'MNG', 'MOZ', 'MRT', 'MUS', 'MWI', 'MYS', 'NAM', 'NER', 'NGA', 'NIC', 'NLD',
  'NOR', 'NPL', 'NZL', 'OMN', 'PAK', 'PAN', 'PER', 'PHL', 'PNG', 'POL', 'PRK', 'PRT', 'PRY', 'QAT',
  'ROU', 'RUS', 'RWA', 'SAU', 'SDN', 'SEN', 'SGP', 'SLB', 'SLE', 'SLV', 'SMR', 'SOM', 'SRB', 'SSD',
  'STP', 'SUR', 'SVK', 'SVN', 'SWE', 'SWZ', 'SYR', 'TCD', 'TGO', 'THA', 'TJK', 'TKM', 'TLS', 'TON',
  'TUR', 'TUV', 'TWN', 'TZA', 'UGA', 'UKR', 'URY', 'USA', 'UZB', 'VAT', 'VCT', 'VEN', 'VNM', 'VUT',
  'WSM', 'YEM', 'ZAF', 'ZMB', 'ZWE',
  // Custom/Legacy aliases in project
  'ALE', 'JAP', 'UK', 'SUE', 'CRO'
]);

export function isValidISOCode(code: string): boolean {
  if (!code) return false;
  return VALID_ISO_CODES.has(code.toUpperCase().trim());
}

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

export function formatPrice(value: number | string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}


