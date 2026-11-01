import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEscPosTicket } from '../src/index.js';

describe('ESC/POS Pure Thermal Generator', () => {
  it('genera secuencia binaria para perfil de 80mm con encabezado y corte', () => {
    const result = buildEscPosTicket({
      profile: '80mm',
      lines: ['[C][B]TIENDA UNISAAS', '[C]NIT: 900.123.456-1', '===', 'Arroz Diana 1kg      $4.500'],
      cutPaper: true,
      openDrawer: false,
    });

    assert.equal(result.contentType, 'application/octet-stream');
    assert.equal(result.encoding, 'base64');
    assert.ok(result.byteLength > 0);
    assert.ok(result.data.length > 0);

    // Verificar comando inicial ESC @ (0x1B, 0x40)
    assert.equal(result.buffer[0], 0x1b);
    assert.equal(result.buffer[1], 0x40);

    // Verificar corte de papel al final GS V 0 (0x1D, 0x56, 0x00)
    const len = result.buffer.length;
    assert.equal(result.buffer[len - 3], 0x1d);
    assert.equal(result.buffer[len - 2], 0x56);
    assert.equal(result.buffer[len - 1], 0x00);
  });

  it('inyecta comando de apertura de gaveta cuando openDrawer es true', () => {
    const conGaveta = buildEscPosTicket({
      profile: '58mm',
      lines: ['Venta Efectivo'],
      openDrawer: true,
      cutPaper: false,
    });

    const sinGaveta = buildEscPosTicket({
      profile: '58mm',
      lines: ['Venta Tarjeta'],
      openDrawer: false,
      cutPaper: false,
    });

    // Secuencia ESC p 0 25 250: [0x1B, 0x70, 0x00, 0x19, 0xFA]
    const drawerCmd = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    assert.ok(conGaveta.buffer.includes(drawerCmd));
    assert.ok(!sinGaveta.buffer.includes(drawerCmd));
  });

  it('ajusta el ancho de los separadores según el perfil (32 cols en 58mm vs 48 cols en 80mm)', () => {
    const t58 = buildEscPosTicket({ profile: '58mm', lines: ['---'], cutPaper: false });
    const t80 = buildEscPosTicket({ profile: '80mm', lines: ['---'], cutPaper: false });

    const sep58 = '-'.repeat(32) + '\n';
    const sep80 = '-'.repeat(48) + '\n';

    assert.ok(t58.buffer.includes(Buffer.from(sep58)));
    assert.ok(t80.buffer.includes(Buffer.from(sep80)));
  });

  it('codifica correctamente caracteres en español a CP850', () => {
    const result = buildEscPosTicket({
      profile: '80mm',
      lines: ['Café con caña, ¿cuánto cuesta? ¡$10!'],
      cutPaper: false,
    });

    // 'é' en CP850 es 0x82, 'ñ' es 0xa4, '¿' es 0xa8, '¡' es 0xad
    assert.ok(result.buffer.includes(0x82)); // é
    assert.ok(result.buffer.includes(0xa4)); // ñ
    assert.ok(result.buffer.includes(0xa8)); // ¿
    assert.ok(result.buffer.includes(0xad)); // ¡
  });

  it('sanitiza caracteres de control arbitrarios para prevenir inyección ESC/POS', () => {
    // Inyección simulada: intentar enviar 0x1B 0x70 (abrir gaveta) dentro del texto de la línea
    const textoMalicioso = 'Producto\x1b\x70\x00\x19\xfaPeligroso';
    const result = buildEscPosTicket({
      profile: '58mm',
      lines: [textoMalicioso],
      openDrawer: false, // Gaveta explícitamente desactivada
      cutPaper: false,
    });

    // La gaveta no debe haberse inyectado desde el texto
    const drawerCmd = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    assert.ok(!result.buffer.includes(drawerCmd));
  });
});

