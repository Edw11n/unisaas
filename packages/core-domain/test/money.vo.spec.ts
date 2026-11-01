import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/value-objects/money.vo.js';
import {
  InvalidMoneyException,
  NegativeMoneyException,
} from '../src/exceptions/domain.exception.js';

describe('Money Value Object', () => {
  it('crea instancias válidas a partir de números, strings y Money', () => {
    const m1 = Money.from(100.5);
    const m2 = Money.from('250.75');
    const m3 = Money.from(m1);

    assert.equal(m1.toString(), '100.50');
    assert.equal(m2.toString(), '250.75');
    assert.equal(m3.toString(), '100.50');
    assert.equal(m1.toNumber(), 100.5);
  });

  it('rechaza montos negativos por defecto para salvaguardar reglas contables', () => {
    assert.throws(() => Money.from(-50), NegativeMoneyException);
    assert.throws(() => Money.from('-10.00'), NegativeMoneyException);
  });

  it('permite montos negativos cuando se autoriza explícitamente', () => {
    const negativeMoney = Money.from('-150.25', true);
    assert.equal(negativeMoney.isNegative(), true);
    assert.equal(negativeMoney.toString(), '-150.25');
  });

  it('rechaza valores no finitos o cadenas inválidas', () => {
    assert.throws(() => Money.from('invalido'), InvalidMoneyException);
    assert.throws(() => Money.from(NaN), InvalidMoneyException);
    assert.throws(() => Money.from(Infinity), InvalidMoneyException);
  });

  it('realiza suma y resta con redondeo financiero HALF_UP a 2 decimales', () => {
    const a = Money.from('100.555'); // redondea a 100.56
    const b = Money.from('50.20');

    assert.equal(a.toString(), '100.56');
    assert.equal(a.add(b).toString(), '150.76');
    assert.equal(a.subtract(b).toString(), '50.36');
  });

  it('impide restas que resulten en valores negativos salvo autorización explícita', () => {
    const menor = Money.from('30.00');
    const mayor = Money.from('100.00');

    assert.throws(() => menor.subtract(mayor), NegativeMoneyException);
    assert.equal(menor.subtract(mayor, true).toString(), '-70.00');
  });

  it('multiplica y divide con precisión', () => {
    const base = Money.from('200.00');
    const multiplied = base.multiply('1.19');
    const divided = base.divide(3);

    assert.equal(multiplied.toString(), '238.00');
    assert.equal(divided.toString(), '66.67');
  });

  it('distribuye montos proporcionalmente sin perder centavos (allocate)', () => {
    const total = Money.from('100.00');
    // Dividir 100.00 en 3 partes iguales (proporción 1:1:1)
    const partes = total.allocate([1, 1, 1]);

    assert.equal(partes.length, 3);
    assert.equal(partes[0].toString(), '33.34'); // Recibe el centavo residual
    assert.equal(partes[1].toString(), '33.33');
    assert.equal(partes[2].toString(), '33.33');

    // La suma de las partes debe ser idéntica al total original
    const suma = partes[0].add(partes[1]).add(partes[2]);
    assert.equal(suma.toString(), '100.00');
    assert.equal(suma.equals(total), true);
  });

  it('compara montos correctamente', () => {
    const m1 = Money.from('50.00');
    const m2 = Money.from('100.00');
    const m3 = Money.from('50.00');

    assert.equal(m2.greaterThan(m1), true);
    assert.equal(m1.lessThan(m2), true);
    assert.equal(m1.equals(m3), true);
    assert.equal(m1.isZero(), false);
    assert.equal(Money.zero().isZero(), true);
  });
});

