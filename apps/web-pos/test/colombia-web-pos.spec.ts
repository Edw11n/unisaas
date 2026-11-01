import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNitDv,
  validateNitWithDv,
  formatNit,
  COLOMBIA_DOCUMENT_TYPES,
  COLOMBIA_DEPARTMENTS,
  HABEAS_DATA_COLOMBIA_STATEMENT,
} from '../src/lib/colombia-documents.js';
import {
  formatCOP,
  COLOMBIAN_DENOMINATIONS,
  calculateCashTotal,
} from '../src/lib/currency.js';
import {
  SAAS_NAVIGATION_ITEMS,
  POS_DOCK_NAV_ITEMS,
} from '../src/lib/navigation.js';
import {
  playBeepSound,
  playSuccessCashSound,
  playErrorSound,
} from '../src/lib/sound-effects.js';

describe('Colombia Web POS & Fiscal Compliance Tests', () => {
  describe('DIAN NIT Verification Digit Algorithm', () => {
    it('debe calcular correctamente el dígito de verificación DIAN para NITs conocidos', () => {
      // Casos de prueba estándar DIAN
      assert.strictEqual(calculateNitDv('900000000'), '5');
      assert.strictEqual(calculateNitDv('800197268'), '4');
      assert.strictEqual(calculateNitDv('901234567'), '7');
      assert.strictEqual(calculateNitDv(''), '0');
    });

    it('debe validar la congruencia de un NIT con su DV declarado', () => {
      assert.strictEqual(validateNitWithDv('900000000', '5'), true);
      assert.strictEqual(validateNitWithDv('900000000', '2'), false);
      assert.strictEqual(validateNitWithDv('800197268', '4'), true);
    });

    it('debe formatear un NIT con puntos y dígito de verificación', () => {
      const formatted = formatNit('900000000');
      assert.strictEqual(formatted, '900.000.000-5');
    });

    it('debe contener los 33 departamentos y municipios de Colombia para localización comercial', () => {
      assert.ok(COLOMBIA_DEPARTMENTS.length >= 32);
      const putumayo = COLOMBIA_DEPARTMENTS.find((d) => d.name === 'Putumayo');
      assert.ok(putumayo);
      assert.ok(putumayo.cities.includes('Mocoa'));
    });

    it('debe incluir la declaración legal obligatoria de Habeas Data (Ley 1581 de 2012)', () => {
      assert.ok(HABEAS_DATA_COLOMBIA_STATEMENT.includes('Ley 1581 de 2012'));
      assert.ok(HABEAS_DATA_COLOMBIA_STATEMENT.includes('UniSaaS'));
    });
  });

  describe('Colombian Currency (COP) & Cash Drawer Reconciliation', () => {
    it('debe formatear montos en pesos colombianos estándar (COP)', () => {
      assert.strictEqual(formatCOP(1500), '$ 1.500');
      assert.strictEqual(formatCOP(1250000), '$ 1.250.000');
      assert.strictEqual(formatCOP(0), '$ 0');
    });

    it('debe tener las denominaciones monetarias oficiales del Banco de la República de Colombia', () => {
      const values = COLOMBIAN_DENOMINATIONS.map((d) => d.value);
      assert.ok(values.includes(100000));
      assert.ok(values.includes(50000));
      assert.ok(values.includes(20000));
      assert.ok(values.includes(10000));
      assert.ok(values.includes(5000));
      assert.ok(values.includes(2000));
      assert.ok(values.includes(1000));
      assert.ok(values.includes(500));
    });

    it('debe totalizar correctamente el arqueo de caja física a partir del conteo de billetes y monedas', () => {
      const counts: Record<number, number> = {
        50000: 4,  // $200.000
        20000: 5,  // $100.000
        10000: 10, // $100.000
        1000: 25,  // $25.000
        500: 10,   // $5.000
      };
      const total = calculateCashTotal(counts);
      assert.strictEqual(total, 430000);
    });
  });

  describe('SaaS Navigation & Audio Synthesis Resiliency', () => {
    it('debe definir las rutas de navegación del administrador y POS', () => {
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/inventory'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/invoices'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/clients'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/gastos'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/balance'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/reportes'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/team'));
      assert.ok(SAAS_NAVIGATION_ITEMS.some((i) => i.href === '/admin/settings'));
      assert.ok(POS_DOCK_NAV_ITEMS.some((i) => i.href === '/pos'));
    });

    it('las funciones de efectos de sonido sintetizados no deben fallar en entornos headless (Node.js sin AudioContext)', () => {
      assert.doesNotThrow(() => playBeepSound());
      assert.doesNotThrow(() => playSuccessCashSound());
      assert.doesNotThrow(() => playErrorSound());
    });
  });
});
