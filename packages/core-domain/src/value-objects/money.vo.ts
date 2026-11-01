import { Decimal } from 'decimal.js';
import {
  InvalidMoneyException,
  NegativeMoneyException,
} from '../exceptions/domain.exception.js';

export class Money {
  private static readonly DECIMALS = 2;
  private static readonly ROUNDING = Decimal.ROUND_HALF_UP;

  private constructor(private readonly value: Decimal) {}

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  static from(value: string | number | Decimal | Money, allowNegative = false): Money {
    if (value instanceof Money) {
      if (!allowNegative && value.isNegative()) {
        throw new NegativeMoneyException();
      }
      return value;
    }

    let parsed: Decimal;
    try {
      parsed = new Decimal(value);
    } catch {
      throw new InvalidMoneyException(`No se pudo parsear el valor monetario: ${value}`);
    }

    if (!parsed.isFinite()) {
      throw new InvalidMoneyException('El valor monetario debe ser un número finito');
    }

    if (!allowNegative && parsed.isNegative()) {
      throw new NegativeMoneyException('El valor monetario no puede ser negativo');
    }

    return new Money(parsed.toDecimalPlaces(Money.DECIMALS, Money.ROUNDING));
  }

  add(other: Money): Money {
    const result = this.value.plus(other.value).toDecimalPlaces(Money.DECIMALS, Money.ROUNDING);
    return new Money(result);
  }

  subtract(other: Money, allowNegative = false): Money {
    const result = this.value.minus(other.value).toDecimalPlaces(Money.DECIMALS, Money.ROUNDING);
    if (!allowNegative && result.isNegative()) {
      throw new NegativeMoneyException(
        `Resta monetaria resulta en valor negativo: ${result.toFixed(Money.DECIMALS)}`,
      );
    }
    return new Money(result);
  }

  multiply(factor: number | string | Decimal): Money {
    const decFactor = new Decimal(factor);
    if (!decFactor.isFinite()) {
      throw new InvalidMoneyException('El factor de multiplicación debe ser un número finito');
    }
    const result = this.value.times(decFactor).toDecimalPlaces(Money.DECIMALS, Money.ROUNDING);
    return new Money(result);
  }

  divide(divisor: number | string | Decimal): Money {
    const decDivisor = new Decimal(divisor);
    if (!decDivisor.isFinite() || decDivisor.isZero()) {
      throw new InvalidMoneyException('El divisor no puede ser cero ni infinito');
    }
    const result = this.value.dividedBy(decDivisor).toDecimalPlaces(Money.DECIMALS, Money.ROUNDING);
    return new Money(result);
  }

  /**
   * Distribución proporcional de montos garantizando que la suma
   * de las partes sea exactamente igual al total sin perder centavos por redondeo.
   */
  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) {
      return [];
    }
    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
    if (totalRatio <= 0) {
      throw new InvalidMoneyException('La suma de proporciones debe ser mayor a cero');
    }

    const remainder = this.value;
    let allocatedTotal = new Decimal(0);
    const results: Money[] = [];

    for (let i = 0; i < ratios.length; i++) {
      const share = this.value
        .times(ratios[i])
        .dividedBy(totalRatio)
        .toDecimalPlaces(Money.DECIMALS, Decimal.ROUND_DOWN);
      allocatedTotal = allocatedTotal.plus(share);
      results.push(new Money(share));
    }

    // Distribuir el centavo residual (diferencia por redondeo hacia abajo)
    let diff = remainder.minus(allocatedTotal).times(100).toNumber();
    let idx = 0;
    while (diff > 0 && idx < results.length) {
      const adjusted = results[idx].value.plus(0.01).toDecimalPlaces(Money.DECIMALS, Money.ROUNDING);
      results[idx] = new Money(adjusted);
      diff -= 1;
      idx += 1;
    }

    return results;
  }

  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  lessThanOrEqual(other: Money): boolean {
    return this.value.lessThanOrEqualTo(other.value);
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  toString(): string {
    return this.value.toFixed(Money.DECIMALS);
  }

  toFixed(dp = Money.DECIMALS): string {
    return this.value.toFixed(dp);
  }

  toJSON(): string {
    return this.toString();
  }

  toDecimal(): Decimal {
    return new Decimal(this.value);
  }
}
