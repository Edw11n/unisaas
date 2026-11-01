import { Decimal } from 'decimal.js';
import {
  InvalidQuantityException,
  NegativeQuantityException,
} from '../exceptions/domain.exception.js';

export class Quantity {
  private static readonly DECIMALS = 4;
  private static readonly ROUNDING = Decimal.ROUND_HALF_UP;

  private constructor(private readonly value: Decimal) {}

  static zero(): Quantity {
    return new Quantity(new Decimal(0));
  }

  static from(value: string | number | Decimal | Quantity, allowNegative = false): Quantity {
    if (value instanceof Quantity) {
      if (!allowNegative && value.isNegative()) {
        throw new NegativeQuantityException();
      }
      return value;
    }

    let parsed: Decimal;
    try {
      parsed = new Decimal(value);
    } catch {
      throw new InvalidQuantityException(`No se pudo parsear la cantidad: ${value}`);
    }

    if (!parsed.isFinite()) {
      throw new InvalidQuantityException('La cantidad debe ser un número finito');
    }

    if (!allowNegative && parsed.isNegative()) {
      throw new NegativeQuantityException('La cantidad de inventario no puede ser negativa');
    }

    return new Quantity(parsed.toDecimalPlaces(Quantity.DECIMALS, Quantity.ROUNDING));
  }

  add(other: Quantity): Quantity {
    const result = this.value.plus(other.value).toDecimalPlaces(Quantity.DECIMALS, Quantity.ROUNDING);
    return new Quantity(result);
  }

  subtract(other: Quantity, allowNegative = false): Quantity {
    const result = this.value.minus(other.value).toDecimalPlaces(Quantity.DECIMALS, Quantity.ROUNDING);
    if (!allowNegative && result.isNegative()) {
      throw new NegativeQuantityException(
        `Resta de cantidad resulta en valor negativo: ${result.toFixed(Quantity.DECIMALS)}`,
      );
    }
    return new Quantity(result);
  }

  multiply(factor: number | string | Decimal): Quantity {
    const decFactor = new Decimal(factor);
    if (!decFactor.isFinite()) {
      throw new InvalidQuantityException('El factor de multiplicación debe ser un número finito');
    }
    const result = this.value.times(decFactor).toDecimalPlaces(Quantity.DECIMALS, Quantity.ROUNDING);
    return new Quantity(result);
  }

  divide(divisor: number | string | Decimal): Quantity {
    const decDivisor = new Decimal(divisor);
    if (!decDivisor.isFinite() || decDivisor.isZero()) {
      throw new InvalidQuantityException('El divisor no puede ser cero ni infinito');
    }
    const result = this.value.dividedBy(decDivisor).toDecimalPlaces(Quantity.DECIMALS, Quantity.ROUNDING);
    return new Quantity(result);
  }

  greaterThan(other: Quantity): boolean {
    return this.value.greaterThan(other.value);
  }

  greaterThanOrEqual(other: Quantity): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  lessThan(other: Quantity): boolean {
    return this.value.lessThan(other.value);
  }

  lessThanOrEqual(other: Quantity): boolean {
    return this.value.lessThanOrEqualTo(other.value);
  }

  equals(other: Quantity): boolean {
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
    return this.value.toFixed(Quantity.DECIMALS);
  }

  toFixed(dp = Quantity.DECIMALS): string {
    return this.value.toFixed(dp);
  }

  toJSON(): string {
    return this.toString();
  }

  toDecimal(): Decimal {
    return new Decimal(this.value);
  }
}
