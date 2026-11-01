import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, Quantity } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import { CppCalculator } from '../domain/cpp-calculator.js';
import type {
  StockAdjustmentDto,
  ReceiveStockDto,
  DispatchStockDto,
  ReverseMovementDto,
  TransferStockDto,
  ReceiveTransferDto,
  CreateStockCountDto,
  ApplyStockCountDto,
} from '../dto/inventory.dto.js';

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

  async getKardexEntries(tenantId: string, variantOrProductId: string, warehouseId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.inventoryLedgerEntry.findMany({
        where: {
          OR: [
            { variantId: variantOrProductId },
            { productId: variantOrProductId },
          ],
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: {
          warehouse: true,
          product: true,
          variant: true,
        },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      });
    });
  }

  /**
   * Ajuste manual de inventario (Entrada o Salida) manteniendo compatibilidad exacta.
   */
  async adjustStock(tenantId: string, userId: string, dto: StockAdjustmentDto) {
    const qty = Quantity.from(dto.quantity, true);
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
      const initialVal = balance ? Number(balance.inventoryValue) : initialQty * initialCost;

      let newOnHand: number;
      let newAverageCost: number;
      let newInventoryValue: number;

      if (isIncrease) {
        const cppResult = CppCalculator.calculateInbound({
          currentQuantity: initialQty,
          currentInventoryValue: initialVal,
          currentAverageCost: initialCost,
          incomingQuantity: qtyNum,
          incomingUnitCost: costNum,
        });
        newOnHand = cppResult.newQuantity;
        newAverageCost = cppResult.newAverageCost;
        newInventoryValue = cppResult.newInventoryValue;
      } else {
        const absQty = Math.abs(qtyNum);
        if (initialQty < absQty) {
          throw new BadRequestException(
            `Existencias insuficientes para ajuste de salida: Disponible ${initialQty}, Requerido ${absQty}`,
          );
        }
        const cppResult = CppCalculator.calculateOutbound({
          currentQuantity: initialQty,
          currentInventoryValue: initialVal,
          currentAverageCost: initialCost,
          outgoingQuantity: absQty,
        });
        newOnHand = cppResult.newQuantity;
        newAverageCost = cppResult.newAverageCost;
        newInventoryValue = cppResult.newInventoryValue;
      }

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
              inventoryValueBefore: initialVal,
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

  /**
   * Recepción de stock (Compras a proveedores o entradas de almacén)
   * Recalcula el Costo Promedio Ponderado (CPP) NIIF de manera canónica.
   */
  async receiveStock(tenantId: string, userId: string, dto: ReceiveStockDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 0. Idempotencia
      if (dto.idempotencyKey) {
        const existingMovement = await tx.inventoryMovement.findFirst({
          where: { referenceDocument: dto.idempotencyKey },
          include: { lines: true },
        });
        if (existingMovement) {
          return {
            isDuplicate: true,
            movementId: existingMovement.id,
            movement: existingMovement,
          };
        }
      }

      // 1. Normalizar líneas a recibir
      const linesToProcess: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        unitCost: number;
        unitOfMeasureId: string;
      }> = [];

      if (dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          const product = await tx.product.findUnique({
            where: { id: line.productId },
            include: { variants: true },
          });
          if (!product) {
            throw new NotFoundException(`Producto con ID ${line.productId} no encontrado`);
          }
          const variant = line.variantId
            ? product.variants.find((v: any) => v.id === line.variantId)
            : product.variants[0];
          if (!variant) {
            throw new NotFoundException(`Variante no encontrada para producto ${line.productId}`);
          }
          linesToProcess.push({
            productId: product.id,
            variantId: variant.id,
            quantity: Quantity.from(line.quantity).toNumber(),
            unitCost: Money.from(line.unitCost).toNumber(),
            unitOfMeasureId: variant.unitOfMeasureId,
          });
        }
      } else if (dto.productId && dto.quantity && dto.unitCost !== undefined) {
        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          include: { variants: true },
        });
        if (!product) {
          throw new NotFoundException(`Producto con ID ${dto.productId} no encontrado`);
        }
        const variant = dto.variantId
          ? product.variants.find((v: any) => v.id === dto.variantId)
          : product.variants[0];
        if (!variant) {
          throw new NotFoundException(`Variante no encontrada para producto ${dto.productId}`);
        }
        linesToProcess.push({
          productId: product.id,
          variantId: variant.id,
          quantity: Quantity.from(dto.quantity).toNumber(),
          unitCost: Money.from(dto.unitCost).toNumber(),
          unitOfMeasureId: variant.unitOfMeasureId,
        });
      } else {
        throw new BadRequestException('Debe especificar producto, cantidad y costo unitario o un arreglo de líneas');
      }

      const movementId = randomUUID();
      const processedResults: any[] = [];
      let lineNumber = 1;

      for (const line of linesToProcess) {
        let balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: line.variantId,
            },
          },
        });

        const currentQty = balance ? Number(balance.quantityOnHand) : 0;
        const currentVal = balance ? Number(balance.inventoryValue) : 0;
        const currentCost = balance ? Number(balance.averageCost) : line.unitCost;

        const cppResult = CppCalculator.calculateInbound({
          currentQuantity: currentQty,
          currentInventoryValue: currentVal,
          currentAverageCost: currentCost,
          incomingQuantity: line.quantity,
          incomingUnitCost: line.unitCost,
        });

        if (!balance) {
          balance = await tx.inventoryBalance.create({
            data: {
              id: randomUUID(),
              tenantId,
              productId: line.productId,
              variantId: line.variantId,
              warehouseId: dto.warehouseId,
              quantityOnHand: cppResult.newQuantity,
              reservedQuantity: 0,
              averageCost: cppResult.newAverageCost,
              inventoryValue: cppResult.newInventoryValue,
              version: 1n,
            },
          });
        } else {
          balance = await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              quantityOnHand: cppResult.newQuantity,
              averageCost: cppResult.newAverageCost,
              inventoryValue: cppResult.newInventoryValue,
              version: { increment: 1n },
            },
          });
        }

        const lineId = randomUUID();
        await tx.inventoryMovementLine.create({
          data: {
            id: lineId,
            tenantId,
            movementId,
            lineNumber: lineNumber++,
            productId: line.productId,
            variantId: line.variantId,
            unitOfMeasureId: line.unitOfMeasureId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            totalCost: cppResult.incomingValue,
            previousQuantity: currentQty,
            newQuantity: cppResult.newQuantity,
            averageCostBefore: currentCost,
            averageCostAfter: cppResult.newAverageCost,
            inventoryValueBefore: currentVal,
            inventoryValueAfter: cppResult.newInventoryValue,
          },
        });

        await tx.inventoryLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            warehouseId: dto.warehouseId,
            movementId,
            productId: line.productId,
            variantId: line.variantId,
            movementType: 'PURCHASE_RECEIPT',
            referenceType: 'PURCHASE',
            referenceId: movementId,
            quantityIn: line.quantity,
            unitCostIn: line.unitCost,
            totalCostIn: cppResult.incomingValue,
            quantityOut: 0,
            unitCostOut: 0,
            totalCostOut: 0,
            balanceQuantityAfter: cppResult.newQuantity,
            averageCostAfter: cppResult.newAverageCost,
            inventoryValueAfter: cppResult.newInventoryValue,
            occurredAt: new Date(),
          },
        });

        processedResults.push({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          incomingValue: cppResult.incomingValue,
          previousStock: currentQty,
          newStock: cppResult.newQuantity,
          previousAverageCost: currentCost,
          newAverageCost: cppResult.newAverageCost,
        });
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          id: movementId,
          tenantId,
          type: 'PURCHASE_RECEIPT',
          status: 'POSTED',
          source: 'PURCHASE',
          warehouseId: dto.warehouseId,
          referenceType: 'PURCHASE',
          referenceDocument: dto.referenceDocument || dto.idempotencyKey || null,
          reason: dto.notes || 'Recepción de mercancía por compra',
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      return {
        movementId,
        movement,
        results: processedResults,
      };
    });
  }

  /**
   * Despacho de stock (Ventas POS o consumo de almacén)
   * Valida existencias disponibles y retorna el Costo de Mercancía Vendida (CMV) para causación en Squad 2.
   */
  async dispatchStock(tenantId: string, userId: string, dto: DispatchStockDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 0. Idempotencia
      if (dto.idempotencyKey) {
        const existingMovement = await tx.inventoryMovement.findFirst({
          where: { referenceDocument: dto.idempotencyKey },
          include: { lines: true },
        });
        if (existingMovement) {
          const totalCost = existingMovement.lines.reduce(
            (sum: number, l: any) => sum + Number(l.totalCost),
            0,
          );
          return {
            isDuplicate: true,
            movementId: existingMovement.id,
            movement: existingMovement,
            totalCost,
          };
        }
      }

      // 1. Normalizar líneas
      const linesToProcess: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        unitOfMeasureId: string;
      }> = [];

      if (dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          const product = await tx.product.findUnique({
            where: { id: line.productId },
            include: { variants: true },
          });
          if (!product) {
            throw new NotFoundException(`Producto con ID ${line.productId} no encontrado`);
          }
          const variant = line.variantId
            ? product.variants.find((v: any) => v.id === line.variantId)
            : product.variants[0];
          if (!variant) {
            throw new NotFoundException(`Variante no encontrada para producto ${line.productId}`);
          }
          linesToProcess.push({
            productId: product.id,
            variantId: variant.id,
            quantity: Quantity.from(line.quantity).toNumber(),
            unitOfMeasureId: variant.unitOfMeasureId,
          });
        }
      } else if (dto.productId && dto.quantity) {
        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          include: { variants: true },
        });
        if (!product) {
          throw new NotFoundException(`Producto con ID ${dto.productId} no encontrado`);
        }
        const variant = dto.variantId
          ? product.variants.find((v: any) => v.id === dto.variantId)
          : product.variants[0];
        if (!variant) {
          throw new NotFoundException(`Variante no encontrada para producto ${dto.productId}`);
        }
        linesToProcess.push({
          productId: product.id,
          variantId: variant.id,
          quantity: Quantity.from(dto.quantity).toNumber(),
          unitOfMeasureId: variant.unitOfMeasureId,
        });
      } else {
        throw new BadRequestException('Debe especificar producto y cantidad o un arreglo de líneas para despachar');
      }

      const movementId = randomUUID();
      const processedResults: any[] = [];
      let totalCostAccumulator = 0;
      let lineNumber = 1;

      for (const line of linesToProcess) {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: line.variantId,
            },
          },
        });

        const currentQty = balance ? Number(balance.quantityOnHand) : 0;
        const currentVal = balance ? Number(balance.inventoryValue) : 0;
        const currentCost = balance ? Number(balance.averageCost) : 0;

        if (currentQty < line.quantity) {
          throw new BadRequestException(
            `Existencias insuficientes para despacho de producto ${line.productId}: Disponible ${currentQty}, Requerido ${line.quantity}`,
          );
        }

        const cppResult = CppCalculator.calculateOutbound({
          currentQuantity: currentQty,
          currentInventoryValue: currentVal,
          currentAverageCost: currentCost,
          outgoingQuantity: line.quantity,
        });

        await tx.inventoryBalance.update({
          where: { id: balance!.id },
          data: {
            quantityOnHand: cppResult.newQuantity,
            averageCost: cppResult.newAverageCost,
            inventoryValue: cppResult.newInventoryValue,
            version: { increment: 1n },
          },
        });

        const lineId = randomUUID();
        await tx.inventoryMovementLine.create({
          data: {
            id: lineId,
            tenantId,
            movementId,
            lineNumber: lineNumber++,
            productId: line.productId,
            variantId: line.variantId,
            unitOfMeasureId: line.unitOfMeasureId,
            quantity: line.quantity,
            unitCost: cppResult.appliedUnitCost,
            totalCost: cppResult.dispatchedValue,
            previousQuantity: currentQty,
            newQuantity: cppResult.newQuantity,
            averageCostBefore: currentCost,
            averageCostAfter: cppResult.newAverageCost,
            inventoryValueBefore: currentVal,
            inventoryValueAfter: cppResult.newInventoryValue,
          },
        });

        await tx.inventoryLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            warehouseId: dto.warehouseId,
            movementId,
            productId: line.productId,
            variantId: line.variantId,
            movementType: 'SALE_DISPATCH',
            referenceType: (dto.referenceType as any) || 'POS_SALE',
            referenceId: movementId,
            quantityIn: 0,
            unitCostIn: 0,
            totalCostIn: 0,
            quantityOut: line.quantity,
            unitCostOut: cppResult.appliedUnitCost,
            totalCostOut: cppResult.dispatchedValue,
            balanceQuantityAfter: cppResult.newQuantity,
            averageCostAfter: cppResult.newAverageCost,
            inventoryValueAfter: cppResult.newInventoryValue,
            occurredAt: new Date(),
          },
        });

        totalCostAccumulator += cppResult.dispatchedValue;
        processedResults.push({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitCost: cppResult.appliedUnitCost,
          totalCost: cppResult.dispatchedValue,
          previousStock: currentQty,
          newStock: cppResult.newQuantity,
        });
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          id: movementId,
          tenantId,
          type: 'SALE_DISPATCH',
          status: 'POSTED',
          source: 'POS',
          warehouseId: dto.warehouseId,
          referenceType: (dto.referenceType as any) || 'POS_SALE',
          referenceDocument: dto.referenceDocument || dto.idempotencyKey || null,
          reason: dto.notes || 'Despacho de mercancía por venta POS',
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      return {
        movementId,
        movement,
        results: processedResults,
        totalCost: totalCostAccumulator,
      };
    });
  }

  /**
   * Reversión de movimiento compensatoria y no destructiva.
   */
  async reverseMovement(tenantId: string, userId: string, dto: ReverseMovementDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const movement = await tx.inventoryMovement.findUnique({
        where: { id: dto.movementId },
        include: { lines: true },
      });

      if (!movement) {
        throw new NotFoundException(`Movimiento con ID ${dto.movementId} no encontrado`);
      }

      if (movement.status === 'REVERSED') {
        throw new ConflictException(`El movimiento ${dto.movementId} ya se encuentra revertido`);
      }

      const reverseMovementId = randomUUID();
      const isDispatch = movement.type === 'SALE_DISPATCH';
      const compensatoryType = isDispatch ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN';
      let lineNumber = 1;

      for (const line of movement.lines) {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: movement.warehouseId,
              variantId: line.variantId,
            },
          },
        });

        if (!balance) {
          throw new NotFoundException(`Balance de inventario no encontrado para variante ${line.variantId}`);
        }

        const currentQty = Number(balance.quantityOnHand);
        const currentVal = Number(balance.inventoryValue);
        const currentCost = Number(balance.averageCost);
        const lineQty = Number(line.quantity);
        const lineCost = Number(line.unitCost);

        let newQty: number;
        let newVal: number;
        let newCost: number;

        if (isDispatch) {
          const res = CppCalculator.reverseOutbound({
            currentQuantity: currentQty,
            currentInventoryValue: currentVal,
            currentAverageCost: currentCost,
            revertedQuantity: lineQty,
            appliedUnitCost: lineCost,
          });
          newQty = res.newQuantity;
          newVal = res.newInventoryValue;
          newCost = res.newAverageCost;
        } else {
          const res = CppCalculator.reverseInbound({
            currentQuantity: currentQty,
            currentInventoryValue: currentVal,
            revertedQuantity: lineQty,
            originalUnitCost: lineCost,
          });
          newQty = res.newQuantity;
          newVal = res.newInventoryValue;
          newCost = res.newAverageCost;
        }

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: newQty,
            inventoryValue: newVal,
            averageCost: newCost,
            version: { increment: 1n },
          },
        });

        const lineId = randomUUID();
        await tx.inventoryMovementLine.create({
          data: {
            id: lineId,
            tenantId,
            movementId: reverseMovementId,
            lineNumber: lineNumber++,
            productId: line.productId,
            variantId: line.variantId,
            unitOfMeasureId: line.unitOfMeasureId,
            quantity: lineQty,
            unitCost: lineCost,
            totalCost: Number(line.totalCost),
            previousQuantity: currentQty,
            newQuantity: newQty,
            averageCostBefore: currentCost,
            averageCostAfter: newCost,
            inventoryValueBefore: currentVal,
            inventoryValueAfter: newVal,
          },
        });

        await tx.inventoryLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            warehouseId: movement.warehouseId,
            movementId: reverseMovementId,
            productId: line.productId,
            variantId: line.variantId,
            movementType: compensatoryType,
            referenceType: isDispatch ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN',
            referenceId: movement.id,
            quantityIn: isDispatch ? lineQty : 0,
            unitCostIn: isDispatch ? lineCost : 0,
            totalCostIn: isDispatch ? Number(line.totalCost) : 0,
            quantityOut: isDispatch ? 0 : lineQty,
            unitCostOut: isDispatch ? 0 : lineCost,
            totalCostOut: isDispatch ? 0 : Number(line.totalCost),
            balanceQuantityAfter: newQty,
            averageCostAfter: newCost,
            inventoryValueAfter: newVal,
            occurredAt: new Date(),
          },
        });
      }

      await tx.inventoryMovement.update({
        where: { id: movement.id },
        data: { status: 'REVERSED' },
      });

      const compensatoryMovement = await tx.inventoryMovement.create({
        data: {
          id: reverseMovementId,
          tenantId,
          type: compensatoryType,
          status: 'POSTED',
          source: 'RETURN',
          warehouseId: movement.warehouseId,
          referenceType: isDispatch ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN',
          referenceDocument: movement.id,
          reason: `Reversión de movimiento ${movement.id}: ${dto.reason}`,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      return {
        originalMovementId: movement.id,
        compensatoryMovementId: reverseMovementId,
        compensatoryMovement,
      };
    });
  }

  /**
   * Transferencia de mercancía entre bodegas (DIRECT o TWO_PHASE).
   */
  async transferStock(tenantId: string, userId: string, dto: TransferStockDto) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException('La bodega de origen y de destino no pueden ser iguales');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const [sourceWh, destWh] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: dto.sourceWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: dto.destinationWarehouseId } }),
      ]);

      if (!sourceWh || sourceWh.status !== 'ACTIVE') {
        throw new NotFoundException(`Bodega origen ${dto.sourceWarehouseId} no disponible`);
      }
      if (!destWh || destWh.status !== 'ACTIVE') {
        throw new NotFoundException(`Bodega destino ${dto.destinationWarehouseId} no disponible`);
      }

      const linesToTransfer = dto.lines || [
        {
          productId: dto.productId!,
          variantId: dto.variantId,
          quantity: dto.quantity!,
        },
      ];

      const transferId = randomUUID();
      const isDirect = (dto.type || 'DIRECT') === 'DIRECT';
      let lineNumber = 1;
      const outboundLines: any[] = [];

      for (const line of linesToTransfer) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          include: { variants: true },
        });
        if (!product) {
          throw new NotFoundException(`Producto ${line.productId} no encontrado`);
        }
        const variant = line.variantId
          ? product.variants.find((v: any) => v.id === line.variantId)
          : product.variants[0];
        if (!variant) {
          throw new NotFoundException(`Variante no encontrada para producto ${line.productId}`);
        }

        const sourceBal = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: dto.sourceWarehouseId,
              variantId: variant.id,
            },
          },
        });

        const currentSourceQty = sourceBal ? Number(sourceBal.quantityOnHand) : 0;
        if (currentSourceQty < line.quantity) {
          throw new BadRequestException(
            `Existencias insuficientes en bodega origen para transferir ${product.name}: Disponible ${currentSourceQty}, Solicitado ${line.quantity}`,
          );
        }

        const sourceCost = sourceBal ? Number(sourceBal.averageCost) : 0;
        const outRes = CppCalculator.calculateOutbound({
          currentQuantity: currentSourceQty,
          currentInventoryValue: Number(sourceBal!.inventoryValue),
          currentAverageCost: sourceCost,
          outgoingQuantity: line.quantity,
        });

        await tx.inventoryBalance.update({
          where: { id: sourceBal!.id },
          data: {
            quantityOnHand: outRes.newQuantity,
            inventoryValue: outRes.newInventoryValue,
            averageCost: outRes.newAverageCost,
            version: { increment: 1n },
          },
        });

        await tx.inventoryLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            warehouseId: dto.sourceWarehouseId,
            movementId: transferId,
            productId: product.id,
            variantId: variant.id,
            movementType: 'TRANSFER_OUT',
            referenceType: 'TRANSFER',
            referenceId: transferId,
            quantityIn: 0,
            unitCostIn: 0,
            totalCostIn: 0,
            quantityOut: line.quantity,
            unitCostOut: sourceCost,
            totalCostOut: outRes.dispatchedValue,
            balanceQuantityAfter: outRes.newQuantity,
            averageCostAfter: outRes.newAverageCost,
            inventoryValueAfter: outRes.newInventoryValue,
            occurredAt: new Date(),
          },
        });

        if (isDirect) {
          let destBal = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_variantId_warehouseId: {
                tenantId,
                warehouseId: dto.destinationWarehouseId,
                variantId: variant.id,
              },
            },
          });

          const currentDestQty = destBal ? Number(destBal.quantityOnHand) : 0;
          const currentDestVal = destBal ? Number(destBal.inventoryValue) : 0;
          const currentDestCost = destBal ? Number(destBal.averageCost) : sourceCost;

          const inRes = CppCalculator.calculateInbound({
            currentQuantity: currentDestQty,
            currentInventoryValue: currentDestVal,
            currentAverageCost: currentDestCost,
            incomingQuantity: line.quantity,
            incomingUnitCost: sourceCost,
          });

          if (!destBal) {
            await tx.inventoryBalance.create({
              data: {
                id: randomUUID(),
                tenantId,
                productId: product.id,
                variantId: variant.id,
                warehouseId: dto.destinationWarehouseId,
                quantityOnHand: inRes.newQuantity,
                reservedQuantity: 0,
                averageCost: inRes.newAverageCost,
                inventoryValue: inRes.newInventoryValue,
                version: 1n,
              },
            });
          } else {
            await tx.inventoryBalance.update({
              where: { id: destBal.id },
              data: {
                quantityOnHand: inRes.newQuantity,
                averageCost: inRes.newAverageCost,
                inventoryValue: inRes.newInventoryValue,
                version: { increment: 1n },
              },
            });
          }

          await tx.inventoryLedgerEntry.create({
            data: {
              id: randomUUID(),
              tenantId,
              warehouseId: dto.destinationWarehouseId,
              movementId: transferId,
              productId: product.id,
              variantId: variant.id,
              movementType: 'TRANSFER_IN',
              referenceType: 'TRANSFER',
              referenceId: transferId,
              quantityIn: line.quantity,
              unitCostIn: sourceCost,
              totalCostIn: outRes.dispatchedValue,
              quantityOut: 0,
              unitCostOut: 0,
              totalCostOut: 0,
              balanceQuantityAfter: inRes.newQuantity,
              averageCostAfter: inRes.newAverageCost,
              inventoryValueAfter: inRes.newInventoryValue,
              occurredAt: new Date(),
            },
          });
        }

        outboundLines.push({
          id: randomUUID(),
          tenantId,
          transferId,
          lineNumber: lineNumber++,
          productId: product.id,
          variantId: variant.id,
          quantity: line.quantity,
          transferUnitCost: sourceCost,
          transferTotalCost: outRes.dispatchedValue,
        });
      }

      const transfer = await tx.inventoryTransfer.create({
        data: {
          id: transferId,
          tenantId,
          sourceWarehouseId: dto.sourceWarehouseId,
          destinationWarehouseId: dto.destinationWarehouseId,
          status: isDirect ? 'COMPLETED' : 'IN_TRANSIT',
          referenceDocument: dto.referenceDocument || dto.idempotencyKey || null,
          notes: dto.notes || `Traslado de inventario (${isDirect ? 'Directo' : 'En dos fases'})`,
          createdById: userId,
          completedById: isDirect ? userId : null,
          shippedAt: new Date(),
          receivedAt: isDirect ? new Date() : null,
          lines: {
            createMany: {
              data: outboundLines,
            },
          },
        },
        include: { lines: true },
      });

      return transfer;
    });
  }

  /**
   * Recepción de transferencia en tránsito (Fase 2 de TWO_PHASE).
   */
  async receiveTransfer(tenantId: string, userId: string, transferId: string, dto: ReceiveTransferDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const transfer = await tx.inventoryTransfer.findUnique({
        where: { id: transferId },
        include: { lines: true },
      });

      if (!transfer) {
        throw new NotFoundException(`Transferencia con ID ${transferId} no encontrada`);
      }

      if (transfer.status !== 'IN_TRANSIT') {
        throw new ConflictException(
          `La transferencia no se encuentra en estado IN_TRANSIT (Estado actual: ${transfer.status})`,
        );
      }

      for (const line of transfer.lines) {
        let destBal = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: transfer.destinationWarehouseId,
              variantId: line.variantId,
            },
          },
        });

        const currentQty = destBal ? Number(destBal.quantityOnHand) : 0;
        const currentVal = destBal ? Number(destBal.inventoryValue) : 0;
        const currentCost = destBal ? Number(destBal.averageCost) : Number(line.transferUnitCost);
        const lineQty = Number(line.quantity);
        const lineCost = Number(line.transferUnitCost);

        const inRes = CppCalculator.calculateInbound({
          currentQuantity: currentQty,
          currentInventoryValue: currentVal,
          currentAverageCost: currentCost,
          incomingQuantity: lineQty,
          incomingUnitCost: lineCost,
        });

        if (!destBal) {
          await tx.inventoryBalance.create({
            data: {
              id: randomUUID(),
              tenantId,
              productId: line.productId,
              variantId: line.variantId,
              warehouseId: transfer.destinationWarehouseId,
              quantityOnHand: inRes.newQuantity,
              reservedQuantity: 0,
              averageCost: inRes.newAverageCost,
              inventoryValue: inRes.newInventoryValue,
              version: 1n,
            },
          });
        } else {
          await tx.inventoryBalance.update({
            where: { id: destBal.id },
            data: {
              quantityOnHand: inRes.newQuantity,
              averageCost: inRes.newAverageCost,
              inventoryValue: inRes.newInventoryValue,
              version: { increment: 1n },
            },
          });
        }

        await tx.inventoryLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            warehouseId: transfer.destinationWarehouseId,
            movementId: transfer.id,
            productId: line.productId,
            variantId: line.variantId,
            movementType: 'TRANSFER_IN',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            quantityIn: lineQty,
            unitCostIn: lineCost,
            totalCostIn: Number(line.transferTotalCost),
            quantityOut: 0,
            unitCostOut: 0,
            totalCostOut: 0,
            balanceQuantityAfter: inRes.newQuantity,
            averageCostAfter: inRes.newAverageCost,
            inventoryValueAfter: inRes.newInventoryValue,
            occurredAt: new Date(),
          },
        });
      }

      return tx.inventoryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'COMPLETED',
          completedById: userId,
          receivedAt: new Date(),
          notes: dto.notes ? `${transfer.notes || ''} | ${dto.notes}` : transfer.notes,
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Apertura de sesión de toma física / conteo de inventario.
   */
  async createStockCount(tenantId: string, userId: string, dto: CreateStockCountDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });

      if (!warehouse || warehouse.status !== 'ACTIVE') {
        throw new NotFoundException(`Bodega con ID ${dto.warehouseId} no encontrada o inactiva`);
      }

      const balances = await tx.inventoryBalance.findMany({
        where: { warehouseId: dto.warehouseId },
      });

      const countId = randomUUID();
      const lines = balances.map((b: any) => ({
        id: randomUUID(),
        tenantId,
        stockCountId: countId,
        productId: b.productId,
        variantId: b.variantId,
        systemQuantity: Number(b.quantityOnHand),
        status: 'PENDING' as const,
      }));

      return tx.stockCount.create({
        data: {
          id: countId,
          tenantId,
          warehouseId: dto.warehouseId,
          status: 'IN_PROGRESS',
          referenceDocument: dto.referenceDocument || null,
          notes: dto.notes || 'Toma física periódica de inventario',
          createdById: userId,
          startedAt: new Date(),
          lines: {
            createMany: {
              data: lines,
            },
          },
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Aplicación contable del conteo físico.
   */
  async applyStockCount(tenantId: string, userId: string, stockCountId: string, dto: ApplyStockCountDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const stockCount = await tx.stockCount.findUnique({
        where: { id: stockCountId },
        include: { lines: true },
      });

      if (!stockCount) {
        throw new NotFoundException(`Conteo físico con ID ${stockCountId} no encontrado`);
      }

      if (stockCount.status === 'COMPLETED') {
        throw new ConflictException(`El conteo físico ${stockCountId} ya fue aplicado previamente`);
      }

      const adjustmentsApplied: any[] = [];

      for (const item of dto.items) {
        const line = stockCount.lines.find(
          (l: any) => l.productId === item.productId || l.id === item.lineId,
        );
        const systemQty = line ? Number(line.systemQuantity) : 0;
        const physicalQty = Quantity.from(item.physicalQuantity).toNumber();
        const diff = physicalQty - systemQty;

        let balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_variantId_warehouseId: {
              tenantId,
              warehouseId: stockCount.warehouseId,
              variantId: item.variantId || (line ? line.variantId : item.productId),
            },
          },
        });

        const currentCost = balance ? Number(balance.averageCost) : 0;

        if (diff !== 0) {
          const isSurplus = diff > 0;
          await this.adjustStock(tenantId, userId, {
            warehouseId: stockCount.warehouseId,
            variantId: item.variantId || (line ? line.variantId : item.productId),
            quantity: diff,
            unitCost: currentCost,
            reason: 'STOCK_COUNT',
            notes: `Ajuste automático de conteo físico #${stockCountId} (${isSurplus ? 'Sobrante' : 'Faltante'})`,
          });

          adjustmentsApplied.push({
            productId: item.productId,
            systemQuantity: systemQty,
            physicalQuantity: physicalQty,
            difference: diff,
            type: isSurplus ? 'SOBRANTE' : 'FALTANTE',
          });
        }

        if (line) {
          await tx.stockCountLine.update({
            where: { id: line.id },
            data: {
              countedQuantity: physicalQty,
              differenceQuantity: diff,
              status: 'APPLIED',
              countedById: userId,
              countedAt: new Date(),
            },
          });
        }
      }

      const completed = await tx.stockCount.update({
        where: { id: stockCount.id },
        data: {
          status: 'COMPLETED',
          completedById: userId,
          completedAt: new Date(),
          notes: dto.notes ? `${stockCount.notes || ''} | ${dto.notes}` : stockCount.notes,
        },
        include: { lines: true },
      });

      return {
        stockCount: completed,
        adjustments: adjustmentsApplied,
      };
    });
  }

  /**
   * Alertas de existencias (Stock bajo / por debajo de stock mínimo).
   */
  async getStockAlerts(tenantId: string, warehouseId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const products = await tx.product.findMany({
        where: { status: 'ACTIVE' },
        include: {
          unitOfMeasure: true,
          variants: true,
          inventoryBalances: {
            where: warehouseId ? { warehouseId } : undefined,
            include: { warehouse: true },
          },
        },
      });

      const alerts: any[] = [];

      for (const p of products) {
        const minAlert = Number(p.minStockAlert);
        const totalOnHand = p.inventoryBalances.reduce(
          (sum: number, b: any) => sum + Number(b.quantityOnHand),
          0,
        );

        if (totalOnHand <= minAlert) {
          const shortage = Math.max(0, minAlert - totalOnHand);
          alerts.push({
            productId: p.id,
            sku: p.sku,
            name: p.name,
            barcode: p.barcode,
            unitOfMeasure: p.unitOfMeasure?.symbol || 'UND',
            minStockAlert: minAlert,
            currentTotalStock: totalOnHand,
            shortage,
            salePrice: Number(p.salePrice),
            balancesByWarehouse: p.inventoryBalances.map((b: any) => ({
              warehouseId: b.warehouseId,
              warehouseName: b.warehouse?.name || '',
              quantityOnHand: Number(b.quantityOnHand),
              averageCost: Number(b.averageCost),
            })),
          });
        }
      }

      return {
        totalAlerts: alerts.length,
        items: alerts,
      };
    });
  }
}
