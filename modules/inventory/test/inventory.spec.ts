import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProductService } from '../src/services/product.service.js';
import { WarehouseService } from '../src/services/warehouse.service.js';
import { StockService } from '../src/services/stock.service.js';
import { ConflictException } from '@nestjs/common';
import { DomainException } from '@unisaas/core-domain';

describe('Módulo de Inventario y Kardex (@unisaas/inventory)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  it('ProductService.createProduct valida precios y montos con Value Objects Money y TaxRate', async () => {
    const service = new ProductService({} as any);

    // Precio de costo negativo debe fallar a nivel de Value Object del Core Domain
    await assert.rejects(
      async () => service.createProduct(tenantId, {
        sku: 'PROD-001',
        name: 'Producto Inválido',
        costPrice: -50,
        sellingPrice: 100,
        categoryId: '00000000-0000-0000-0000-000000000001',
        unitOfMeasureId: '00000000-0000-0000-0000-000000000002',
      }),
      (err: any) => err instanceof DomainException,
    );

    // Tasa de impuesto fuera de rango (ej. 150%) debe fallar a nivel de Value Object
    await assert.rejects(
      async () => service.createProduct(tenantId, {
        sku: 'PROD-001',
        name: 'Producto Tasa Inválida',
        costPrice: 50,
        sellingPrice: 100,
        taxRate: 150,
        categoryId: '00000000-0000-0000-0000-000000000001',
        unitOfMeasureId: '00000000-0000-0000-0000-000000000002',
      }),
      (err: any) => err instanceof DomainException,
    );
  });

  it('WarehouseService.createWarehouse detecta códigos de bodega duplicados con ConflictException', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        warehouse: {
          findFirst: async () => ({ id: 'w1', code: 'BOD-01' }),
        },
      }),
    } as any;

    const service = new WarehouseService(mockPrisma);

    await assert.rejects(
      async () => service.createWarehouse(tenantId, {
        branchId: '00000000-0000-0000-0000-000000000001',
        code: 'BOD-01',
        name: 'Bodega Principal',
      }),
      (err: any) => err instanceof ConflictException,
    );
  });

  it('StockService.adjustStock genera balance, movimiento y asiento de kardex con cálculos exactos', async () => {
    let createdBalance: any = null;
    let createdMovement: any = null;
    let createdLedgerEntry: any = null;

    const mockTx = {
      $executeRawUnsafe: async () => {},
      productVariant: {
        findUnique: async () => ({
          productId: '00000000-0000-0000-0000-000000000001',
          unitOfMeasureId: '00000000-0000-0000-0000-000000000002',
        }),
      },
      inventoryBalance: {
        findUnique: async () => null, // Nuevo balance
        create: async (args: any) => {
          createdBalance = args.data;
          return args.data;
        },
      },
      inventoryMovement: {
        create: async (args: any) => {
          createdMovement = args.data;
          return args.data;
        },
      },
      inventoryLedgerEntry: {
        create: async (args: any) => {
          createdLedgerEntry = args.data;
          return args.data;
        },
      },
    };

    const mockPrisma = {
      $transaction: async (cb: any) => cb(mockTx),
    } as any;

    const service = new StockService(mockPrisma);

    const result = await service.adjustStock(tenantId, '00000000-0000-0000-0000-000000000099', {
      warehouseId: '00000000-0000-0000-0000-000000000010',
      variantId: '00000000-0000-0000-0000-000000000020',
      quantity: 15,
      unitCost: 1200,
      reason: 'INITIAL_STOCK',
      notes: 'Inventario inicial de apertura',
    });

    assert.ok(result);
    assert.equal(createdBalance.quantityOnHand, 15);
    assert.equal(createdBalance.averageCost, 1200);
    assert.equal(createdMovement.type, 'ADJUSTMENT_IN');
    assert.equal(createdMovement.status, 'POSTED');
    assert.equal(createdLedgerEntry.quantityIn, 15);
    assert.equal(createdLedgerEntry.balanceQuantityAfter, 15);
    assert.equal(createdLedgerEntry.totalCostIn, 18000);
  });
});
