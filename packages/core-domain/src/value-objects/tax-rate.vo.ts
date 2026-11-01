import { Decimal } from 'decimal.js';
import { InvalidTaxRateException } from '../exceptions/domain.exception.js';
import { Money } from './money.vo.js';

export class TaxRate {
  private static readonly DECIMALS = 2;
  private static readonly ROUNDING = Decimal.ROUND_HALF_UP;

  private constructor(private readonly ratePercent: Decimal) {}

  static zero(): TaxRate {
    return new TaxRate(new Decimal(0));
  }

  static from(percentage: number | string | Decimal | TaxRate): TaxRate {
    if (percentage instanceof TaxRate) {
      return percentage;
    }

    let parsed: Decimal;
    try {
      parsed = new Decimal(percentage);
    } catch {
      throw new InvalidTaxRateException(`No se pudo parsear la tasa de impuesto: ${percentage}`);
    }

    if (!parsed.isFinite() || parsed.isNegative() || parsed.greaterThan(100)) {
      throw new InvalidTaxRateException(
        `La tasa de impuesto debe estar entre 0% y 100%. Recibido: ${percentage}`,
      );
    }

    return new TaxRate(parsed.toDecimalPlaces(TaxRate.DECIMALS, TaxRate.ROUNDING));
  }

  /**
   * Calcula el impuesto IVA a partir de la base imponible.
   * Tax = Base * (Rate / 100)
   */
  calculateTax(base: Money): Money {
    const factor = this.ratePercent.dividedBy(100);
    return base.multiply(factor);
  }

  /**
   * Desagrega la base gravable a partir de un valor total que ya incluye impuesto.
   * Base = Total / (1 + (Rate / 100))
   */
  calculateBaseFromTotal(total: Money): Money {
    const divisor = new Decimal(1).plus(this.ratePercent.dividedBy(100));
    return total.divide(divisor);
  }

  /**
   * Retorna el monto total aplicando el impuesto a la base.
   * Total = Base + Tax
   */
  applyTo(base: Money): Money {
    return base.add(this.calculateTax(base));
  }

  get percentage(): number {
    return this.ratePercent.toNumber();
  }

  toDecimal(): Decimal {
    return this.ratePercent.dividedBy(100);
  }

  toString(): string {
    return `${this.ratePercent.toFixed(TaxRate.DECIMALS)}%`;
  }

  toJSON(): number {
    return this.percentage;
  }
}
