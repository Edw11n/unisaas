import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, Quantity, TaxRate } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreatePurchaseDto } from '../dto/credits.dto.js';

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPurchases(tenantId: string, branchId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.purchase.findMany({
        where: branchId ? { branchId } : undefined,
        include: {
          supplier: true,
          warehouse: true,
          items: true,
          creator: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { purchaseDate: 'desc' },
        take: 50,
      });
    });
  }

  async getPurchaseById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: {
          supplier: true,
          warehouse: true,
          items: true,
          creator: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!purchase) {
        throw new NotFoundException(`Compra con ID ${id} no encontrada`);
      }

      return purchase;
    });
  }

  async createPurchase(tenantId: string, userId: string, dto: CreatePurchaseDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La compra debe contener al menos un producto o ítem');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 1. Validar proveedor
      const supplier = await tx.thirdParty.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(`Proveedor con ID ${dto.supplierId} no encontrado`);
      }

      if (supplier.partyType !== 'SUPPLIER' && supplier.partyType !== 'BOTH') {
        throw new BadRequestException(`El tercero ${supplier.name} no está registrado como proveedor`);
      }

      // 2. Validar que no se duplique la factura del proveedor
      const existingInv = await tx.purchase.findFirst({
        where: {
          supplierId: dto.supplierId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
        },
      });

      if (existingInv) {
        throw new ConflictException(
          `Ya existe una compra registrada con la factura de proveedor "${dto.supplierInvoiceNumber}"`,
        );
      }

      // 3. Calcular montos e impuestos con Value Objects puros
      let runningSubtotal = Money.zero();
      let runningTaxTotal = Money.zero();

      const preparedItems = dto.items.map((item) => {
        const qty = Quantity.from(item.quantity);
        const cost = Money.from(item.unitCost);
        const taxRate = item.taxRate !== undefined ? TaxRate.from(item.taxRate) : TaxRate.from(19);

        const itemSubtotal = cost.multiply(qty.toNumber());
        const itemTax = taxRate.calculateTax(itemSubtotal);
        const itemTotal = itemSubtotal.add(itemTax);

        runningSubtotal = runningSubtotal.add(itemSubtotal);
        runningTaxTotal = runningTaxTotal.add(itemTax);

        return {
          id: randomUUID(),
          tenantId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          productSku: item.productSku,
          quantity: qty.toNumber(),
          unitOfMeasure: 'UNIDAD',
          unitCost: cost.toNumber(),
          taxRate: taxRate.percentage,
          subtotal: itemSubtotal.toNumber(),
          taxAmount: itemTax.toNumber(),
          total: itemTotal.toNumber(),
        };
      });

      const grandTotal = runningSubtotal.add(runningTaxTotal);
      const purchaseId = randomUUID();

      // 4. Crear compra
      const purchase = await tx.purchase.create({
        data: {
          id: purchaseId,
          tenantId,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          purchaseDate: new Date(),
          subtotal: runningSubtotal.toNumber(),
          taxTotal: runningTaxTotal.toNumber(),
          grandTotal: grandTotal.toNumber(),
          paymentType: dto.paymentType,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: 'RECEIVED',
          createdBy: userId,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });

      // 5. Si la compra es a crédito, registrar en cartera de proveedores (cuentas por pagar)
      if (dto.paymentType === 'CREDITO') {
        const prevDebt = Money.from(supplier.currentDebt.toString());
        const newDebt = prevDebt.add(grandTotal);

        await tx.thirdParty.update({
          where: { id: dto.supplierId },
          data: { currentDebt: newDebt.toNumber() },
        });

        await tx.creditTransaction.create({
          data: {
            id: randomUUID(),
            tenantId,
            thirdPartyId: dto.supplierId,
            type: 'SUPPLIER_PURCHASE',
            amount: grandTotal.toNumber(),
            previousBalance: prevDebt.toNumber(),
            newBalance: newDebt.toNumber(),
            referenceNumber: dto.supplierInvoiceNumber,
            createdById: userId,
          },
        });
      }

      return purchase;
    });
  }
}

