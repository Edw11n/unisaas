import { BadRequestException } from '@nestjs/common';
import { Money } from '@unisaas/core-domain';

export interface CausePosSaleInput {
  invoiceId: string;
  invoiceConsecutive: string;
  branchId: string;
  customerId?: string | null;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  costOfGoodsSold?: number | null;
}

export interface BuiltSalesPosLine {
  accountCode: string;
  thirdPartyId?: string | null;
  description: string;
  debit: number;
  credit: number;
  nature: 'D' | 'C';
}

export interface BuiltSalesPosCausation {
  concept: string;
  lines: BuiltSalesPosLine[];
}

/**
 * Constructor especializado para la causación contable de ventas POS por partida doble.
 * Aplica normas colombianas NIIF/PUC:
 * - Cuenta de pago (Caja 110505 / Bancos-Digital 111005 / Cartera-Fiados 130505)
 * - Ingreso por comercio (413505)
 * - IVA generado 19% (240805)
 * - Ajuste al peso por redondeo (429595 / 539595) con tolerancia legal de $1.00 COP
 * - Costo de ventas e inventarios (613505 / 143505)
 */
export class SalesPosCausationBuilder {
  static build(input: CausePosSaleInput): BuiltSalesPosCausation {
    const totalMoney = Money.from(input.total || 0);
    const subtotalMoney = Money.from(input.subtotal || 0);
    const taxMoney = Money.from(input.taxAmount || 0);
    const cogsMoney = Money.from(input.costOfGoodsSold || 0);

    // 1. Determinar la cuenta de recaudo según el método de pago
    let paymentAccountCode = '110505'; // Caja General
    let paymentDesc = 'Recaudo venta efectivo';

    const normalizedPaymentMethod = (input.paymentMethod || 'EFECTIVO').toUpperCase().trim();

    if (normalizedPaymentMethod === 'CREDITO_FIADO' || normalizedPaymentMethod === 'CREDITO') {
      paymentAccountCode = '130505'; // Clientes Nacionales (Cartera / Fiados)
      paymentDesc = 'Venta crédito fiado a cliente';
    } else if (
      ['TARJETA', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'NEQUI', 'DAVIPLATA', 'TRANSFERENCIA'].includes(
        normalizedPaymentMethod,
      )
    ) {
      paymentAccountCode = '111005'; // Moneda Nacional (Bancos / Digital)
      paymentDesc = `Recaudo venta digital (${normalizedPaymentMethod})`;
    }

    const lines: BuiltSalesPosLine[] = [
      // 1. Débito a Caja / Bancos / Clientes por el Total
      {
        accountCode: paymentAccountCode,
        thirdPartyId: input.customerId || null,
        description: paymentDesc,
        debit: totalMoney.toNumber(),
        credit: 0,
        nature: 'D',
      },
      // 2. Crédito a Ingresos por el Subtotal
      {
        accountCode: '413505', // Comercio al por mayor y al por menor
        thirdPartyId: input.customerId || null,
        description: `Venta mercancías Fac ${input.invoiceConsecutive}`,
        debit: 0,
        credit: subtotalMoney.toNumber(),
        nature: 'C',
      },
    ];

    // 3. Crédito a IVA Generado (si aplica)
    if (taxMoney.isPositive()) {
      lines.push({
        accountCode: '240805', // IVA Generado en Ventas POS
        thirdPartyId: input.customerId || null,
        description: 'IVA generado venta POS',
        debit: 0,
        credit: taxMoney.toNumber(),
        nature: 'C',
      });
    }

    // 4. Verificación de centavo por redondeo (subtotal + taxAmount vs total)
    // Tolerancia legal máxima en Colombia: $1.00 COP
    const MAX_ROUNDING_TOLERANCE_COP = 1.0;
    const expectedTotal = subtotalMoney.add(taxMoney);
    const diff = totalMoney.subtract(expectedTotal).toNumber();

    if (Math.abs(diff) > MAX_ROUNDING_TOLERANCE_COP) {
      throw new BadRequestException(
        `Descuadre contable POS inaceptable: La diferencia entre el total ($${totalMoney.toString()}) y base + IVA ($${expectedTotal.toString()}) es de $${Math.abs(
          diff,
        )} COP, superando el límite legal de $${MAX_ROUNDING_TOLERANCE_COP} COP.`,
      );
    }

    if (diff > 0) {
      // Ingreso por ajuste al peso (Crédito 429595)
      lines.push({
        accountCode: '429595',
        description: 'Ajuste al peso favorable por redondeo',
        debit: 0,
        credit: diff,
        nature: 'C',
      });
    } else if (diff < 0) {
      // Gasto por ajuste al peso (Débito 539595)
      lines.push({
        accountCode: '539595',
        description: 'Ajuste al peso desfavorable por redondeo',
        debit: Math.abs(diff),
        credit: 0,
        nature: 'D',
      });
    }

    // 5. Costo de Ventas e Inventario (Causación de Kardex / CPP si cogs > 0)
    if (cogsMoney.isPositive()) {
      lines.push({
        accountCode: '613505', // Costo de ventas
        description: `Costo mercancía vendida Fac ${input.invoiceConsecutive}`,
        debit: cogsMoney.toNumber(),
        credit: 0,
        nature: 'D',
      });
      lines.push({
        accountCode: '143505', // Mercancías no fabricadas por la empresa
        description: `Salida inventario por venta Fac ${input.invoiceConsecutive}`,
        debit: 0,
        credit: cogsMoney.toNumber(),
        nature: 'C',
      });
    }

    return {
      concept: `Venta POS Comprobante ${input.invoiceConsecutive}`,
      lines,
    };
  }
}
