/**
 * Mapa de conversión de caracteres en español a la página de códigos CP850 (Latin-1 / Multilingual)
 */
export const CP850_MAP: Record<string, number> = {
  'á': 0xa0,
  'é': 0x82,
  'í': 0xa1,
  'ó': 0xa2,
  'ú': 0xa3,
  'Á': 0xb5,
  'É': 0x90,
  'Í': 0xd6,
  'Ó': 0xe0,
  'Ú': 0xe9,
  'ñ': 0xa4,
  'Ñ': 0xa5,
  'ü': 0x81,
  'Ü': 0x9a,
  '¿': 0xa8,
  '¡': 0xad,
  '°': 0xf8,
  '$': 0x24,
};

/**
 * Codifica una cadena de texto a un Buffer en CP850,
 * sanitizando caracteres de control peligrosos (< 0x20)
 * para evitar inyecciones de comandos en la impresora térmica.
 */
export function encodeCp850(text: string): Buffer {
  const bytes: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (CP850_MAP[char] !== undefined) {
      bytes.push(CP850_MAP[char]);
    } else {
      const code = char.charCodeAt(0);
      // Sanitización contra inyección de comandos ESC/POS:
      // Se descartan caracteres de control arbitrarios (< 0x20)
      // excepto salto de línea (\n = 0x0A) y tabulador horizontal (\t = 0x09)
      if (code < 0x20 && code !== 0x0a && code !== 0x09) {
        continue;
      }
      bytes.push(code <= 0x7f ? code : 0x3f); // '?' para caracteres fuera de rango
    }
  }

  return Buffer.from(bytes);
}

