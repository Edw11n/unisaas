import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Quantity } from '../src/value-objects/quantity.vo.js';
import {
  InvalidQuantityException,
  NegativeQuantityException,
} from '../src/exceptions/domain.exception.js';

describe('Quantity Value Object', () => {
  it('crea instancias válidas con precisión a 4 decimales para inventario', () => {
    const q1 = Quantity.from(12.5);
    const q2 = Quantity.from('3.14159'); // redondea a 3.1416
    const q3 = Quantity.zero();

    assert.equal(q1.toString(), '12.5000');
    assert.equal(q2.toString(), '3.1416');
    assert.equal(q3.toString(), '0.0000');
    assert.equal(q3.isZero(), true);
  });

  it('rechaza cantidades negativas salvo indicación explícita', () => {
    assert.throws(() => Quantity.from(-5), NegativeQuantityException);
    assert.throws(() => Quantity.from('-0.0001'), NegativeQuantityException);

    const negativeQ = Quantity.from('-2.5000', true);
    assert.equal(negativeQ.isNegative(), true);
    assert.equal(negativeQ.toString(), '-2.5000');
  });

  it('rechaza valores no finitos o cadenas inválidas', () => {
    assert.throws(() => Quantity.from('no-numero'), InvalidQuantityException);
    assert.throws(() => Quantity.from(NaN), InvalidQuantityException);
  });

  it('suma y resta cantidades de stock con precisión', () => {
    const stockInicial = Quantity.from('100.0000');
    const entrada = Quantity.from('25.5000');
    const salida = Quantity.from('10.2500');

    const stockActualizado = stockInicial.add(entrada).subtract(salida);
    assert.equal(stockActualizado.toString(), '115.2500');
  });

  it('impide restar por debajo de cero', () => {
    const disponible = Quantity.from('5.0000');
    const solicitado = Quantity.from('6.0000');

    assert.throws(() => disponible.subtract(solicitado), NegativeQuantityException);
  });

  it('compara cantidades correctamente', () => {
    const q1 = Quantity.from('10.0000');
    const q2 = Quantity.from('20.0000');

    assert.equal(q2.greaterThan(q1), true);
    assert.equal(q1.lessThan(q2), true);
    assert.equal(q1.equals(Quantity.from('10.0000')), true);
  });
});

