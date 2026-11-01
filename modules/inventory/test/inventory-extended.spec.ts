import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CppCalculator } from '../src/domain/cpp-calculator.js';
import { StockService } from '../src/services/stock.service.js';
import { ProductService } from '../src/services/product.service.js';
import { CategoryService } from '../src/services/category.service.js';

describe('Squad 3 — Motor de Inventario, Kardex Multi-Bodega & Costo Promedio Ponderado (CPP)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const warehouseA = 'w1111111-1111-4111-8111-111111111111';
  const warehouseB = 'w2222222-2222-4222-8222-222222222222';
  const productId = 'p1111111-1111-4111-8111-111111111111';
  const variantId = 'v1111111-1111-4111-8111-111111111111';
  const userId = 'u1111111-1111-4111-8111-111111111111';

  describe('1. Política Matemática y Algoritmo de Costo Promedio Ponderado (CPP)', () => {
    it('calcula correctamente el CPP en compras sucesivas a costos distintos', () => {
      // 1ra Compra: 50 unidades @ $3.400 = $170.000 -> CPP = $3.400
      const step1 = CppCalculator.calculateInbound({
        currentQuantity: 0,
        currentInventoryValue: 0,
        currentAverageCost: 0,
        incomingQuantity: 50,
        incomingUnitCost: 3400,
      });

      assert.equal(step1.newQuantity, 50);
      assert.equal(step1.newInventoryValue, 170000);
      assert.equal(step1.newAverageCost, 3400);

      // 2da Compra: 50 unidades @ $3.800 = $190.000 -> Total Valor: $360.000 / 100 unidades -> CPP = $3.600
      const step2 = CppCalculator.calculateInbound({
        currentQuantity: step1.newQuantity,
        currentInventoryValue: step1.newInventoryValue,
        currentAverageCost: step1.newAverageCost,
        incomingQuantity: 50,
        incomingUnitCost: 3800,
      });

      assert.equal(step2.newQuantity, 100);
      assert.equal(step2.newInventoryValue, 360000);
      assert.equal(step2.newAverageCost, 3600);
    });

    it('el despacho descuenta a valor de CPP y mantiene el costo promedio mientras haya saldo', () => {
      // Despacho de 30 unidades con saldo de 100 unidades @ CPP $3.600
      const out = CppCalculator.calculateOutbound({
        currentQuantity: 100,
        currentInventoryValue: 360000,
        currentAverageCost: 3600,
        outgoingQuantity: 30,
      });

      assert.equal(out.dispatchedValue, 108000); // 30 * 3.600
      assert.equal(out.newQuantity, 70);
      assert.equal(out.newInventoryValue, 252000); // 70 * 3.600
      assert.equal(out.newAverageCost, 3600); // CPP permanece inalterado
      assert.equal(out.appliedUnitCost, 3600);
    });

    it('el agotamiento total de existencias resetea el valor y el costo promedio a cero', () => {
      const out = CppCalculator.calculateOutbound({
        currentQuantity: 70,
        currentInventoryValue: 252000,
        currentAverageCost: 3600,
        outgoingQuantity: 70,
      });

      assert.equal(out.newQuantity, 0);
      assert.equal(out.newInventoryValue, 0);
      assert.equal(out.newAverageCost, 0);
    });

    it('rechaza despachos cuando la cantidad solicitada supera las existencias disponibles', () => {
      assert.throws(
        () =>
          CppCalculator.calculateOutbound({
            currentQuantity: 10,
            currentInventoryValue: 36000,
            currentAverageCost: 3600,
            outgoingQuantity: 25,
          }),
        /Existencias insuficientes para despacho/,
      );
    });
  });

  describe('2. Recepción y Despacho de Mercancía (StockService)', () => {
    it('receiveStock crea balance, movimiento de entrada y kardex con recálculo de CPP', async () => {
      let createdBalance: any = null;
      let createdMovement: any = null;
      let createdLedger: any = null;

      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: {
          findFirst: async () => null,
          create: async (args: any) => {
            createdMovement = args.data;
            return { ...args.data, id: args.data.id };
          },
        },
        product: {
          findUnique: async () => ({
            id: productId,
            variants: [{ id: variantId, unitOfMeasureId: 'uom-1' }],
          }),
        },
        inventoryBalance: {
          findUnique: async () => null,
          create: async (args: any) => {
            createdBalance = args.data;
            return args.data;
          },
          update: async (args: any) => {
            createdBalance = args.data;
            return args.data;
          },
        },
        inventoryMovementLine: {
          create: async (args: any) => args.data,
        },
        inventoryLedgerEntry: {
          create: async (args: any) => {
            createdLedger = args.data;
            return args.data;
          },
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const result = await service.receiveStock(tenantId, userId, {
        warehouseId: warehouseA,
        productId,
        quantity: 50,
        unitCost: 3400,
        notes: 'Factura Compra 9876',
      });

      assert.ok(result);
      assert.equal(createdBalance.quantityOnHand, 50);
      assert.equal(createdBalance.averageCost, 3400);
      assert.equal(createdMovement.type, 'PURCHASE_RECEIPT');
      assert.equal(createdLedger.quantityIn, 50);
      assert.equal(createdLedger.totalCostIn, 170000);
    });

    it('dispatchStock valida existencias, descuenta stock y retorna CMV al costo CPP', async () => {
      let updatedBalance: any = null;
      let createdMovement: any = null;

      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: {
          findFirst: async () => null,
          create: async (args: any) => {
            createdMovement = args.data;
            return { ...args.data, id: args.data.id };
          },
        },
        product: {
          findUnique: async () => ({
            id: productId,
            variants: [{ id: variantId, unitOfMeasureId: 'uom-1' }],
          }),
        },
        inventoryBalance: {
          findUnique: async () => ({
            id: 'bal-1',
            quantityOnHand: 50,
            averageCost: 3400,
            inventoryValue: 170000,
          }),
          update: async (args: any) => {
            updatedBalance = args.data;
            return args.data;
          },
        },
        inventoryMovementLine: {
          create: async (args: any) => args.data,
        },
        inventoryLedgerEntry: {
          create: async (args: any) => args.data,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const result = await service.dispatchStock(tenantId, userId, {
        warehouseId: warehouseA,
        productId,
        quantity: 5,
        notes: 'Venta POS 1024',
      });

      assert.ok(result);
      assert.equal(updatedBalance.quantityOnHand, 45);
      assert.equal(result.totalCost, 17000); // 5 * $3.400
      assert.equal(createdMovement.type, 'SALE_DISPATCH');
    });

    it('dispatchStock rechaza despachos cuando no hay existencias con BadRequestException', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: { findFirst: async () => null },
        product: {
          findUnique: async () => ({
            id: productId,
            variants: [{ id: variantId, unitOfMeasureId: 'uom-1' }],
          }),
        },
        inventoryBalance: {
          findUnique: async () => ({
            id: 'bal-1',
            quantityOnHand: 2,
            averageCost: 3400,
            inventoryValue: 6800,
          }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      await assert.rejects(
        async () =>
          service.dispatchStock(tenantId, userId, {
            warehouseId: warehouseA,
            productId,
            quantity: 10, // Requiere 10, sólo hay 2
          }),
        (err: any) => err instanceof BadRequestException,
      );
    });

    it('receiveStock respeta la idempotencia retornando el movimiento existente', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: {
          findFirst: async () => ({
            id: 'mov-existente-001',
            type: 'PURCHASE_RECEIPT',
            lines: [{ totalCost: 170000 }],
          }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const result = await service.receiveStock(tenantId, userId, {
        warehouseId: warehouseA,
        productId,
        quantity: 50,
        unitCost: 3400,
        idempotencyKey: 'idem-rec-001',
      });

      assert.ok(result);
      assert.equal(result.isDuplicate, true);
      assert.equal(result.movementId, 'mov-existente-001');
    });
  });

  describe('3. Reversión Compensatoria y Auditoría (StockService.reverseMovement)', () => {
    it('genera contra-movimiento de devolución al cliente restaurando existencias físicas', async () => {
      let updatedBalance: any = null;
      let compensatoryMovement: any = null;

      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: {
          findUnique: async () => ({
            id: 'mov-disp-001',
            type: 'SALE_DISPATCH',
            status: 'POSTED',
            warehouseId: warehouseA,
            lines: [
              {
                id: 'line-1',
                productId,
                variantId,
                unitOfMeasureId: 'uom-1',
                quantity: 5,
                unitCost: 3400,
                totalCost: 17000,
                lineNumber: 1,
              },
            ],
          }),
          update: async () => ({}),
          create: async (args: any) => {
            compensatoryMovement = args.data;
            return { ...args.data, id: args.data.id };
          },
        },
        inventoryBalance: {
          findUnique: async () => ({
            id: 'bal-1',
            quantityOnHand: 45,
            averageCost: 3400,
            inventoryValue: 153000,
          }),
          update: async (args: any) => {
            updatedBalance = args.data;
            return args.data;
          },
        },
        inventoryMovementLine: { create: async (args: any) => args.data },
        inventoryLedgerEntry: { create: async (args: any) => args.data },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const result = await service.reverseMovement(tenantId, userId, {
        movementId: 'mov-disp-001',
        reason: 'Cliente devolvió producto por factura anulada',
      });

      assert.ok(result);
      assert.equal(updatedBalance.quantityOnHand, 50); // 45 + 5 restaurados
      assert.equal(compensatoryMovement.type, 'CUSTOMER_RETURN');
    });

    it('previene la doble reversión de un movimiento con ConflictException', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        inventoryMovement: {
          findUnique: async () => ({
            id: 'mov-ya-revertido',
            status: 'REVERSED',
            lines: [],
          }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      await assert.rejects(
        async () =>
          service.reverseMovement(tenantId, userId, {
            movementId: 'mov-ya-revertido',
            reason: 'Intento duplicado',
          }),
        (err: any) => err instanceof ConflictException,
      );
    });
  });

  describe('4. Transferencias entre Bodegas (StockService.transferStock)', () => {
    it('rechaza traslados donde origen y destino son la misma bodega', async () => {
      const service = new StockService({} as any);

      await assert.rejects(
        async () =>
          service.transferStock(tenantId, userId, {
            sourceWarehouseId: warehouseA,
            destinationWarehouseId: warehouseA,
            productId,
            quantity: 10,
          }),
        (err: any) => err instanceof BadRequestException,
      );
    });

    it('ejecuta traslado DIRECT descontando origen e ingresando destino en la misma transacción', async () => {
      let createdTransfer: any = null;

      const mockTx = {
        $executeRawUnsafe: async () => {},
        warehouse: {
          findUnique: async (args: any) => ({
            id: args.where.id,
            status: 'ACTIVE',
          }),
        },
        product: {
          findUnique: async () => ({
            id: productId,
            name: 'Arroz Florhuila',
            variants: [{ id: variantId, unitOfMeasureId: 'uom-1' }],
          }),
        },
        inventoryBalance: {
          findUnique: async (args: any) => {
            if (args.where.tenantId_variantId_warehouseId.warehouseId === warehouseA) {
              return {
                id: 'bal-orig',
                quantityOnHand: 50,
                averageCost: 3400,
                inventoryValue: 170000,
              };
            }
            return null; // En destino aún no hay balance
          },
          update: async () => ({}),
          create: async () => ({}),
        },
        inventoryLedgerEntry: { create: async () => ({}) },
        inventoryTransfer: {
          create: async (args: any) => {
            createdTransfer = args.data;
            return { ...args.data, lines: [] };
          },
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const transfer = await service.transferStock(tenantId, userId, {
        sourceWarehouseId: warehouseA,
        destinationWarehouseId: warehouseB,
        productId,
        quantity: 10,
        type: 'DIRECT',
      });

      assert.ok(transfer);
      assert.equal(createdTransfer.status, 'COMPLETED');
      assert.equal(createdTransfer.sourceWarehouseId, warehouseA);
      assert.equal(createdTransfer.destinationWarehouseId, warehouseB);
    });
  });

  describe('5. Tomas Físicas y Alertas de Stock (StockCount & StockAlerts)', () => {
    it('applyStockCount asienta ajustes automáticos por diferencias físicas encontradas', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        stockCount: {
          findUnique: async () => ({
            id: 'count-001',
            warehouseId: warehouseA,
            status: 'IN_PROGRESS',
            lines: [{ id: 'line-1', productId, variantId, systemQuantity: 50 }],
          }),
          update: async (args: any) => ({ ...args.data }),
        },
        inventoryBalance: {
          findUnique: async () => ({
            id: 'bal-1',
            quantityOnHand: 50,
            averageCost: 3400,
            inventoryValue: 170000,
          }),
          update: async () => ({}),
        },
        productVariant: {
          findUnique: async () => ({ productId, unitOfMeasureId: 'uom-1' }),
        },
        inventoryMovement: { create: async (args: any) => args.data },
        inventoryLedgerEntry: { create: async (args: any) => args.data },
        stockCountLine: { update: async () => ({}) },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const result = await service.applyStockCount(tenantId, userId, 'count-001', {
        items: [
          {
            productId,
            variantId,
            physicalQuantity: 42, // Faltante de 8 unidades
          },
        ],
      });

      assert.ok(result);
      assert.equal(result.adjustments.length, 1);
      assert.equal(result.adjustments[0].difference, -8);
      assert.equal(result.adjustments[0].type, 'FALTANTE');
    });

    it('getStockAlerts identifica productos con stock total inferior o igual al mínimo', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        product: {
          findMany: async () => [
            {
              id: productId,
              sku: 'SKU-ARR-001',
              name: 'Arroz Florhuila',
              barcode: '7701234567890',
              minStockAlert: 10,
              salePrice: 4500,
              unitOfMeasure: { symbol: 'KG' },
              inventoryBalances: [
                {
                  warehouseId: warehouseA,
                  quantityOnHand: 4, // 4 <= 10 -> Alerta!
                  averageCost: 3400,
                  warehouse: { name: 'Bodega Principal' },
                },
              ],
            },
          ],
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new StockService(mockPrisma);

      const alerts = await service.getStockAlerts(tenantId);

      assert.ok(alerts);
      assert.equal(alerts.totalAlerts, 1);
      assert.equal(alerts.items[0].shortage, 6); // 10 - 4 = 6
    });
  });

  describe('6. Catálogo, Código de Barras y Categorías (ProductService & CategoryService)', () => {
    it('ProductService.findByBarcode encuentra el producto mediante escáner', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        productBarcode: {
          findFirst: async () => ({
            barcode: '7701234567890',
            product: {
              id: productId,
              name: 'Arroz Florhuila',
              sku: 'SKU-ARR-001',
            },
          }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new ProductService(mockPrisma);

      const prod = await service.findByBarcode(tenantId, '7701234567890');

      assert.ok(prod);
      assert.equal(prod.id, productId);
      assert.equal(prod.name, 'Arroz Florhuila');
    });

    it('CategoryService.createCategory rechaza categorías con nombre duplicado', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        productCategory: {
          findFirst: async () => ({ id: 'cat-1', name: 'Granos y Cereales' }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new CategoryService(mockPrisma);

      await assert.rejects(
        async () =>
          service.createCategory(tenantId, {
            name: 'Granos y Cereales',
          }),
        (err: any) => err instanceof ConflictException,
      );
    });
  });
});
