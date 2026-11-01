import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TaxRate } from '../src/value-objects/tax-rate.vo.js';
import { Money } from '../src/value-objects/money.vo.js';
import { InvalidTaxRateException } from '../src/exceptions/domain.exception.js';

describe('TaxRate Value Object', () => {
  it('crea tasas de impuesto válidas (0%, 5%, 19%)', () => {
    const t0 = TaxRate.zero();
    const t5 = TaxRate.from(5);
    const t19 = TaxRate.from('19');

    assert.equal(t0.percentage, 0);
    assert.equal(t5.percentage, 5);
    assert.equal(t19.percentage, 19);
    assert.equal(t19.toString(), '19.00%');
  });

  it('rechaza tasas negativas o superiores al 100%', () => {
    assert.throws(() => TaxRate.from(-1), InvalidTaxRateException);
    assert.throws(() => TaxRate.from(100.01), InvalidTaxRateException);
    assert.throws(() => TaxRate.from('abc'), InvalidTaxRateException);
  });

  it('calcula impuesto a partir de la base gravable', () => {
    const base = Money.from('100000.00');
    const iva19 = TaxRate.from(19);

    const impuesto = iva19.calculateTax(base);
    assert.equal(impuesto.toString(), '19000.00');

    const totalConImpuesto = iva19.applyTo(base);
    assert.equal(totalConImpuesto.toString(), '119000.00');
  });

  it('desagrega la base gravable a partir del total con impuesto', () => {
    const total = Money.from('119000.00');
    const iva19 = TaxRate.from(19);

    const baseCalculada = iva19.calculateBaseFromTotal(total);
    assert.equal(baseCalculada.toString(), '100000.00');
  });
});

