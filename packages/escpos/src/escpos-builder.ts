import { encodeCp850 } from './cp850.js';
import { EscPosTicketOptions, EscPosTicketResult } from './types.js';

export class EscPosBuilder {
  static build(options: EscPosTicketOptions): EscPosTicketResult {
    const is80mm = options.profile === '80mm';
    const maxColumns = is80mm ? 48 : 32;
    const bufferChunks: Buffer[] = [];

    // 1. Inicializar impresora: ESC @ (0x1B, 0x40)
    bufferChunks.push(Buffer.from([0x1b, 0x40]));

    // 2. Seleccionar página de códigos CP850: ESC t 2 (0x1B, 0x74, 0x02)
    bufferChunks.push(Buffer.from([0x1b, 0x74, 0x02]));

    // 3. Abrir gaveta si fue solicitado: ESC p 0 25 250
    if (options.openDrawer) {
      bufferChunks.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    }

    // 4. Procesamiento de líneas de texto
    for (const rawLine of options.lines) {
      if (rawLine === '---' || rawLine === '===') {
        const separatorChar = rawLine === '===' ? '=' : '-';
        const sepLine = separatorChar.repeat(maxColumns) + '\n';
        bufferChunks.push(encodeCp850(sepLine));
        continue;
      }

      let lineText = rawLine;
      let alignCode = 0x00; // 0: Left por defecto
      let isBold = false;

      if (lineText.startsWith('[C]')) {
        alignCode = 0x01; // Center
        lineText = lineText.slice(3);
      } else if (lineText.startsWith('[R]')) {
        alignCode = 0x02; // Right
        lineText = lineText.slice(3);
      }

      if (lineText.startsWith('[B]')) {
        isBold = true;
        lineText = lineText.slice(3);
      }

      // Aplicar alineación: ESC a n (0: Left, 1: Center, 2: Right)
      bufferChunks.push(Buffer.from([0x1b, 0x61, alignCode]));

      // Aplicar negrita si corresponde: ESC E 1
      if (isBold) {
        bufferChunks.push(Buffer.from([0x1b, 0x45, 0x01]));
      }

      bufferChunks.push(encodeCp850(lineText + '\n'));

      // Desactivar negrita: ESC E 0
      if (isBold) {
        bufferChunks.push(Buffer.from([0x1b, 0x45, 0x00]));
      }
    }

    // 5. Alimentar líneas de avance: ESC d n
    const feedCount = options.feedLines ?? 3;
    if (feedCount > 0) {
      bufferChunks.push(Buffer.from([0x1b, 0x64, Math.min(feedCount, 10)]));
    }

    // 6. Corte de papel: GS V 0 (0x1D, 0x56, 0x00)
    if (options.cutPaper !== false) {
      bufferChunks.push(Buffer.from([0x1d, 0x56, 0x00]));
    }

    const finalBuffer = Buffer.concat(bufferChunks);

    return {
      buffer: finalBuffer,
      contentType: 'application/octet-stream',
      byteLength: finalBuffer.length,
      encoding: 'base64',
      data: finalBuffer.toString('base64'),
    };
  }
}

export function buildEscPosTicket(options: EscPosTicketOptions): EscPosTicketResult {
  return EscPosBuilder.build(options);
}

