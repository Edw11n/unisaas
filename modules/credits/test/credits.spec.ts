import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ThirdPartyService } from '../src/services/third-party.service.js';
import { CreditService } from '../src/services/credit.service.js';
import { PurchaseService } from '../src/services/purchase.service.js';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Módulo de Terceros, Compras y Cartera / Créditos (@unisaas/credits)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const userId = 'u0000000-0000-0000-0000-000000000001';
  const thirdPartyId = 't0000000-0000-0000-0000-000000000001';
  const supplierId = 's0000000-0000-0000-0000-000000000001';

  it('ThirdPartyService.createThirdParty rechaza documento duplicado con ConflictException', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findFirst: async () => ({ id: 'tp-1', documentNumber: '10203040' }),
        },
      }),
    } as any;

    const service = new ThirdPartyService(mockPrisma);

    await assert.rejects(
      async () => service.createThirdParty(tenantId, {
        documentType: 'CC',
        documentNumber: '10203040',
        name: 'Cliente Existente',
        partyType: 'CUSTOMER',
      }),
      (err: any) => err instanceof ConflictException,
    );
  });

  it('ThirdPartyService.getThirdPartyById lanza NotFoundException si no existe el tercero', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => null,
        },
      }),
    } as any;

    const service = new ThirdPartyService(mockPrisma);

    await assert.rejects(
      async () => service.getThirdPartyById(tenantId, 'non-existent'),
      (err: any) => err instanceof NotFoundException,
    );
  });

  it('CreditService.registerTransaction bloquea montos cero o negativos', async () => {
    const mockPrisma = {} as any;
    const service = new CreditService(mockPrisma);

    await assert.rejects(
      async () => service.registerTransaction(tenantId, userId, {
        thirdPartyId,
        type: 'CHARGE_CREDIT_SALE',
        amount: 0,
      }),
      (err: any) => err instanceof BadRequestException,
    );

    await assert.rejects(
      async () => service.registerTransaction(tenantId, userId, {
        thirdPartyId,
        type: 'CUSTOMER_PAYMENT',
        amount: -5000,
      }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('CreditService.registerTransaction lanza NotFoundException si el tercero no existe', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => null,
        },
      }),
    } as any;

    const service = new CreditService(mockPrisma);

    await assert.rejects(
      async () => service.registerTransaction(tenantId, userId, {
        thirdPartyId: 'non-existent-tp',
        type: 'CHARGE_CREDIT_SALE',
        amount: 10000,
      }),
      (err: any) => err instanceof NotFoundException,
    );
  });

  it('CreditService.registerTransaction bloquea ventas a crédito que excedan el cupo asignado', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: thirdPartyId,
            currentDebt: 80000,
            creditLimit: 100000, // Cupo disponible: 20.000
          }),
        },
      }),
    } as any;

    const service = new CreditService(mockPrisma);

    // Intento de venta fiada por 30.000 (totalizaría 110.000, superando los 100.000)
    await assert.rejects(
      async () => service.registerTransaction(tenantId, userId, {
        thirdPartyId,
        type: 'CHARGE_CREDIT_SALE',
        amount: 30000,
      }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('CreditService.registerTransaction rechaza abonos que excedan la deuda actual', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: thirdPartyId,
            currentDebt: 25000,
            creditLimit: 100000,
          }),
        },
      }),
    } as any;

    const service = new CreditService(mockPrisma);

    await assert.rejects(
      async () => service.registerTransaction(tenantId, userId, {
        thirdPartyId,
        type: 'CUSTOMER_PAYMENT',
        amount: 30000, // Excede los 25.000 de deuda actual
      }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('CreditService.registerTransaction aplica abonos válidos y reduce la deuda con precisión', async () => {
    let updatedDebt: number | null = null;
    let createdTx: any = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: thirdPartyId,
            currentDebt: 80000,
            creditLimit: 100000,
          }),
          update: async (args: any) => {
            updatedDebt = args.data.currentDebt;
            return args.data;
          },
        },
        creditTransaction: {
          create: async (args: any) => {
            createdTx = args.data;
            return args.data;
          },
        },
      }),
    } as any;

    const service = new CreditService(mockPrisma);

    const result = await service.registerTransaction(tenantId, userId, {
      thirdPartyId,
      type: 'CUSTOMER_PAYMENT',
      amount: 50000,
      paymentMethod: 'NEQUI',
      referenceNumber: 'NEQ-12345',
    });

    assert.ok(result);
    assert.equal(updatedDebt, 30000); // 80.000 - 50.000
    assert.equal(result.currentDebt, 30000);
    assert.equal(createdTx.previousBalance, 80000);
    assert.equal(createdTx.newBalance, 30000);
    assert.equal(createdTx.amount, 50000);
  });

  it('CreditService.registerTransaction soporta SUPPLIER_PAYMENT reduciendo cuentas por pagar', async () => {
    let updatedSupplierDebt: number | null = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: supplierId,
            currentDebt: 500000, // Debe 500.000 al proveedor
            creditLimit: 0,
          }),
          update: async (args: any) => {
            updatedSupplierDebt = args.data.currentDebt;
            return args.data;
          },
        },
        creditTransaction: {
          create: async (args: any) => args.data,
        },
      }),
    } as any;

    const service = new CreditService(mockPrisma);

    const result = await service.registerTransaction(tenantId, userId, {
      thirdPartyId: supplierId,
      type: 'SUPPLIER_PAYMENT',
      amount: 200000,
      paymentMethod: 'TRANSFERENCIA',
      referenceNumber: 'TRANS-999',
    });

    assert.ok(result);
    assert.equal(updatedSupplierDebt, 300000);
    assert.equal(result.currentDebt, 300000);
  });

  it('PurchaseService.createPurchase valida ítems no vacíos y rol de proveedor', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: 'client-only',
            name: 'Cliente Regular',
            partyType: 'CUSTOMER', // No es SUPPLIER ni BOTH
          }),
        },
      }),
    } as any;

    const service = new PurchaseService(mockPrisma);

    // Sin items
    await assert.rejects(
      async () => service.createPurchase(tenantId, userId, {
        branchId: 'b-1',
        warehouseId: 'w-1',
        supplierId,
        supplierInvoiceNumber: 'FAC-001',
        paymentType: 'CONTADO',
        items: [],
      }),
      (err: any) => err instanceof BadRequestException,
    );

    // Tercero no es proveedor
    await assert.rejects(
      async () => service.createPurchase(tenantId, userId, {
        branchId: 'b-1',
        warehouseId: 'w-1',
        supplierId: 'client-only',
        supplierInvoiceNumber: 'FAC-001',
        paymentType: 'CONTADO',
        items: [{
          productId: 'prod-1',
          variantId: 'var-1',
          productSku: 'SKU-001',
          productName: 'Café',
          quantity: 1,
          unitCost: 10000,
        }],
      }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('PurchaseService.createPurchase calcula totales e IVA 19% y crea cuenta por pagar en CREDITO', async () => {
    let createdPurchase: any = null;
    let updatedSupplierDebt: number | null = null;
    let createdCreditTx: any = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        thirdParty: {
          findUnique: async () => ({
            id: supplierId,
            name: 'Distribuidora Central SAS',
            partyType: 'SUPPLIER',
            currentDebt: 100000,
          }),
          update: async (args: any) => {
            updatedSupplierDebt = args.data.currentDebt;
            return args.data;
          },
        },
        purchase: {
          findFirst: async () => null, // No duplicado
          create: async (args: any) => {
            createdPurchase = args.data;
            return {
              id: args.data.id,
              ...args.data,
              items: args.data.items.create,
            };
          },
        },
        creditTransaction: {
          create: async (args: any) => {
            createdCreditTx = args.data;
            return args.data;
          },
        },
      }),
    } as any;

    const service = new PurchaseService(mockPrisma);

    // 2 unidades a $100.000 con 19% IVA: Subtotal = 200.000, IVA = 38.000, Total = 238.000
    const purchase = await service.createPurchase(tenantId, userId, {
      branchId: 'b-1',
      warehouseId: 'w-1',
      supplierId,
      supplierInvoiceNumber: 'FAC-PROV-7788',
      paymentType: 'CREDITO',
      items: [
        {
          productId: 'prod-100',
          variantId: 'var-100',
          productSku: 'HARINA-50',
          productName: 'Harina Especial 50kg',
          quantity: 2,
          unitCost: 100000,
          taxRate: 19,
        },
      ],
    });

    assert.ok(purchase);
    assert.equal(createdPurchase.subtotal, 200000);
    assert.equal(createdPurchase.taxTotal, 38000);
    assert.equal(createdPurchase.grandTotal, 238000);
    assert.equal(createdPurchase.status, 'RECEIVED');

    // Validación de aumento en cuenta por pagar del proveedor: 100.000 + 238.000 = 338.000
    assert.equal(updatedSupplierDebt, 338000);
    assert.equal(createdCreditTx.amount, 238000);
    assert.equal(createdCreditTx.previousBalance, 100000);
    assert.equal(createdCreditTx.newBalance, 338000);
    assert.equal(createdCreditTx.type, 'SUPPLIER_PURCHASE');
  });
});
