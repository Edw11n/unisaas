import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, Quantity } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { StockAdjustmentDto } from '../dto/inventory.dto.js';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaClient) {}

  async getBalances(tenantId: string, warehouseId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.inventoryBalance.findMany({
        where: warehouseId ? { warehouseId } : undefined,
        include: {
          variant: {
            include: { product: true },
          },
          warehouse: true,
        },
      });
    });
  }

  async getKardexEntries(tenantId: string, variantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.inventoryLedgerEntry.findMany({
        where: { variantId },
        include: {
          warehouse: true,
        },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      });
    });
  }

  async adjustStock(tenantId: string, userId: string, dto: StockAdjustmentDto) {
    const qty = Quantity.from(dto.quantity, true); // Permite negativos si es ajuste de salida
    const cost = Money.from(dto.unitCost);
    const qtyNum = qty.toNumber();
    const costNum = cost.toNumber();
    const isIncrease = qtyNum >= 0;

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 0. Obtener variante para productId y unitOfMeasureId
      const variant = await tx.productVariant.findUnique({
        where: { id: dto.variantId },
        select: { productId: true, unitOfMeasureId: true },
      });

      if (!variant) {
        throw new NotFoundException(`Variante de producto ${dto.variantId} no encontrada`);
      }

      // 1. Obtener o inicializar balance de stock
      let balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_variantId_warehouseId: {
            tenantId,
            warehouseId: dto.warehouseId,
            variantId: dto.variantId,
          },
        },
      });

      const initialQty = balance ? Number(balance.quantityOnHand) : 0;
      const initialCost = balance ? Number(balance.averageCost) : costNum;
      const newOnHand = initialQty + qtyNum;
      const newAverageCost = isIncrease && newOnHand > 0 ? costNum : initialCost;
      const newInventoryValue = newOnHand * newAverageCost;

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            id: randomUUID(),
            tenantId,
            productId: variant.productId,
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
            quantityOnHand: newOnHand,
            reservedQuantity: 0,
            averageCost: newAverageCost,
            inventoryValue: newInventoryValue,
          },
        });
      } else {
        balance = await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: newOnHand,
            averageCost: newAverageCost,
            inventoryValue: newInventoryValue,
          },
        });
      }

      // 2. Registrar movimiento de inventario
      const movementId = randomUUID();
      const movement = await tx.inventoryMovement.create({
        data: {
          id: movementId,
          tenantId,
          type: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          status: 'POSTED',
          source: 'ADJUSTMENT',
          warehouseId: dto.warehouseId,
          referenceType: 'MANUAL_ADJUSTMENT',
          adjustmentReason: dto.reason as any,
          reason: dto.notes || `Ajuste manual de inventario (${dto.reason})`,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: {
              id: randomUUID(),
              tenantId,
              lineNumber: 1,
              productId: variant.productId,
              variantId: dto.variantId,
              unitOfMeasureId: variant.unitOfMeasureId,
              quantity: Math.abs(qtyNum),
              unitCost: costNum,
              totalCost: costNum * Math.abs(qtyNum),
              previousQuantity: initialQty,
              newQuantity: newOnHand,
              averageCostBefore: initialCost,
              averageCostAfter: newAverageCost,
              inventoryValueBefore: initialQty * initialCost,
              inventoryValueAfter: newInventoryValue,
            },
          },
        },
      });

      // 3. Registrar asiento en el libro auxiliar Kardex
      const ledgerEntry = await tx.inventoryLedgerEntry.create({
        data: {
          id: randomUUID(),
          tenantId,
          movementId,
          productId: variant.productId,
          variantId: dto.variantId,
          warehouseId: dto.warehouseId,
          movementType: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          referenceType: 'MANUAL_ADJUSTMENT',
          referenceId: movementId,
          quantityIn: isIncrease ? Math.abs(qtyNum) : 0,
          unitCostIn: isIncrease ? costNum : 0,
          totalCostIn: isIncrease ? costNum * Math.abs(qtyNum) : 0,
          quantityOut: !isIncrease ? Math.abs(qtyNum) : 0,
          unitCostOut: !isIncrease ? costNum : 0,
          totalCostOut: !isIncrease ? costNum * Math.abs(qtyNum) : 0,
          balanceQuantityAfter: newOnHand,
          averageCostAfter: newAverageCost,
          inventoryValueAfter: newInventoryValue,
          occurredAt: new Date(),
        },
      });

      return {
        movement,
        balance,
        ledgerEntry,
      };
    });
  }
}
