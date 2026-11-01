import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, Quantity, TaxRate } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreateInvoiceDto, VoidInvoiceDto } from '../dto/sales.dto.js';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getInvoices(tenantId: string, branchId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.invoice.findMany({
        where: branchId ? { branchId } : undefined,
        include: {
          items: true,
          posShift: true,
          creator: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  }

  async getInvoiceById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          items: true,
          posShift: true,
          customer: true,
          creator: { select: { id: true, fullName: true, email: true } },
          voider: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!invoice) {
        throw new NotFoundException(`Factura con ID ${id} no encontrada`);
      }

      return invoice;
    });
  }

  async createInvoice(tenantId: string, userId: string, dto: CreateInvoiceDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La factura debe contener al menos un producto o ítem');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 1. Validar idempotencia si se proporcionó clave
      if (dto.idempotencyKey) {
        const existingInvoice = await tx.invoice.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { items: true },
        });

        if (existingInvoice) {
          return existingInvoice;
        }
      }

      // 2. Calcular montos e impuestos con Value Objects matemáticamente exactos
      let runningSubtotal = Money.zero();
      let runningTaxTotal = Money.zero();
      let runningDiscountTotal = Money.zero();

      const processedItems = dto.items.map((item) => {
        const qty = Quantity.from(item.quantity);
        const price = Money.from(item.unitPrice);
        const cost = item.unitCost ? Money.from(item.unitCost) : Money.zero();
        const taxRate = item.taxRate !== undefined ? TaxRate.from(item.taxRate) : TaxRate.from(19);
        const discountRate = item.discountRate ? TaxRate.from(item.discountRate) : TaxRate.zero();

        const itemGross = price.multiply(qty.toNumber());
        const itemDiscount = discountRate.calculateTax(itemGross);
        const itemNet = itemGross.subtract(itemDiscount);
        const itemTax = taxRate.calculateTax(itemNet);
        const itemTotal = itemNet.add(itemTax);

        runningSubtotal = runningSubtotal.add(itemNet);
        runningTaxTotal = runningTaxTotal.add(itemTax);
        runningDiscountTotal = runningDiscountTotal.add(itemDiscount);

        return {
          id: randomUUID(),
          tenantId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          productSku: item.productSku,
          quantity: qty.toNumber(),
          unitOfMeasure: 'UNIDAD',
          unitPrice: price.toNumber(),
          unitCost: cost.toNumber(),
          discountRate: discountRate.percentage,
          discountAmount: itemDiscount.toNumber(),
          taxRate: taxRate.percentage,
          taxAmount: itemTax.toNumber(),
          subtotal: itemNet.toNumber(),
          total: itemTotal.toNumber(),
        };
      });

      const grandTotal = runningSubtotal.add(runningTaxTotal);

      // Calcular cambio si el pago es en efectivo
      let cashTenderedNum: number | null = null;
      let changeGivenNum: number | null = null;

      if (dto.paymentMethod === 'EFECTIVO' && dto.cashTendered !== undefined) {
        const tendered = Money.from(dto.cashTendered);
        if (tendered.lessThan(grandTotal)) {
          throw new BadRequestException(`El efectivo recibido ($${tendered.toString()}) es menor al total ($${grandTotal.toString()})`);
        }
        cashTenderedNum = tendered.toNumber();
        changeGivenNum = tendered.subtract(grandTotal).toNumber();
      }

      const invoiceId = randomUUID();
      const consecutive = `FAC-${Date.now().toString().slice(-8)}`;

      // 3. Crear factura e ítems
      const invoice = await tx.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId: dto.branchId,
          posShiftId: dto.posShiftId || null,
          consecutive,
          customerId: dto.customerId || null,
          customerName: dto.customerName || 'Consumidor Final',
          customerDocument: dto.customerDocument || '222222222',
          subtotal: runningSubtotal.toNumber(),
          discountTotal: runningDiscountTotal.toNumber(),
          taxTotal: runningTaxTotal.toNumber(),
          total: grandTotal.toNumber(),
          paymentMethod: dto.paymentMethod,
          cashTendered: cashTenderedNum,
          changeGiven: changeGivenNum,
          status: 'ISSUED',
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: userId,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
          posShift: true,
        },
      });

      // 4. Si hay turno de caja asociado, actualizar acumuladores del turno
      if (dto.posShiftId) {
        const isCash = dto.paymentMethod === 'EFECTIVO';
        const isDigital = dto.paymentMethod === 'NEQUI' || dto.paymentMethod === 'DAVIPLATA' || dto.paymentMethod === 'TARJETA';
        const isCredit = dto.paymentMethod === 'CREDITO_FIADO';

        await tx.posShift.update({
          where: { id: dto.posShiftId },
          data: {
            totalSales: { increment: grandTotal.toNumber() },
            totalCashSales: isCash ? { increment: grandTotal.toNumber() } : undefined,
            totalDigitalSales: isDigital ? { increment: grandTotal.toNumber() } : undefined,
            totalCreditSales: isCredit ? { increment: grandTotal.toNumber() } : undefined,
          },
        });
      }

      return invoice;
    });
  }

  async voidInvoice(tenantId: string, id: string, voidedById: string, dto: VoidInvoiceDto) {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Debe ingresar un motivo para la anulación de la factura');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        throw new NotFoundException(`Factura con ID ${id} no encontrada`);
      }

      if (invoice.status === 'VOIDED') {
        return {
          ...invoice,
          alreadyVoided: true,
        };
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: dto.reason,
          voidedBy: voidedById,
          voidedAt: new Date(),
        },
        include: {
          items: true,
          voider: { select: { id: true, fullName: true, email: true } },
        },
      });

      return {
        ...updated,
        alreadyVoided: false,
      };
    });
  }
}
