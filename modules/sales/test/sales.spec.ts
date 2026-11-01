import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PosShiftService } from '../src/services/pos-shift.service.js';
import { InvoiceService } from '../src/services/invoice.service.js';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Módulo de Ventas, Facturación y Turnos de Caja POS (@unisaas/sales)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const branchId = 'b0000000-0000-0000-0000-000000000001';
  const cashierId = 'c0000000-0000-0000-0000-000000000001';

  it('PosShiftService.openShift rechaza apertura si el cajero ya tiene un turno abierto en la sucursal', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        posShift: {
          findFirst: async () => ({ id: 'shift-open-1', status: 'OPEN' }),
        },
      }),
    } as any;

    const service = new PosShiftService(mockPrisma);

    await assert.rejects(
      async () => service.openShift(tenantId, cashierId, {
        branchId,
        initialCash: 100000,
      }),
      (err: any) => err instanceof ConflictException,
    );
  });

  it('PosShiftService.closeShift calcula correctamente el efectivo esperado y la diferencia de caja', async () => {
    let updatedShift: any = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        posShift: {
          findUnique: async () => ({
            id: 'shift-1',
            status: 'OPEN',
            initialCash: 50000,
            totalCashSales: 150000,
          }),
          update: async (args: any) => {
            updatedShift = args.data;
            return { ...args.data, id: 'shift-1' };
          },
        },
      }),
    } as any;

    const service = new PosShiftService(mockPrisma);

    // Esperado: 50.000 inicial + 150.000 ventas = 200.000.
    // Conteo real reportado: 210.000 (sobrante de 10.000)
    await service.closeShift(tenantId, 'shift-1', cashierId, {
      actualCash: 210000,
    });

    assert.ok(updatedShift);
    assert.equal(updatedShift.status, 'CLOSED');
    assert.equal(updatedShift.expectedCash, 200000);
    assert.equal(updatedShift.actualCash, 210000);
    assert.equal(updatedShift.difference, 10000);
  });

  it('InvoiceService.createInvoice calcula subtotal, IVA y total con precisión matemática y actualiza acumuladores', async () => {
    let createdInvoiceData: any = null;
    let shiftIncrementData: any = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        invoice: {
          findUnique: async () => null,
          create: async (args: any) => {
            createdInvoiceData = args.data;
            return { ...args.data, id: args.data.id };
          },
        },
        posShift: {
          update: async (args: any) => {
            shiftIncrementData = args.data;
            return args.data;
          },
        },
      }),
    } as any;

    const service = new InvoiceService(mockPrisma);

    // 2 unidades a $10.000 con 19% IVA
    // Base = 20.000, IVA = 3.800, Total = 23.800
    const result = await service.createInvoice(tenantId, cashierId, {
      branchId,
      posShiftId: 'shift-1',
      paymentMethod: 'EFECTIVO',
      cashTendered: 30000,
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000010',
          variantId: '00000000-0000-0000-0000-000000000020',
          productName: 'Camisa Polo',
          productSku: 'POLO-001',
          quantity: 2,
          unitPrice: 10000,
          taxRate: 19,
        },
      ],
    });

    assert.ok(result);
    assert.equal(createdInvoiceData.subtotal, 20000);
    assert.equal(createdInvoiceData.taxTotal, 3800);
    assert.equal(createdInvoiceData.total, 23800);
    assert.equal(createdInvoiceData.cashTendered, 30000);
    assert.equal(createdInvoiceData.changeGiven, 6200); // 30.000 - 23.800
    assert.equal(shiftIncrementData.totalSales.increment, 23800);
    assert.equal(shiftIncrementData.totalCashSales.increment, 23800);
  });

  describe('Anulación Idempotente de Facturas POS (Squad 6)', () => {
    it('voidInvoice marca la factura como VOIDED y persiste motivo y usuario emisor', async () => {
      let updateArgs: any = null;
      const invoiceRecord = {
        id: 'inv-void-1',
        status: 'ISSUED',
        total: 50000,
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb({
          $executeRawUnsafe: async () => {},
          invoice: {
            findUnique: async () => invoiceRecord,
            update: async (args: any) => {
              updateArgs = args;
              return {
                ...invoiceRecord,
                status: 'VOIDED',
                voidReason: args.data.voidReason,
                voidedBy: args.data.voidedBy,
                voidedAt: args.data.voidedAt,
              };
            },
          },
        }),
      } as any;

      const service = new InvoiceService(mockPrisma);
      const res = await service.voidInvoice(tenantId, 'inv-void-1', cashierId, {
        reason: 'Error de digitación en mostrador',
      });

      assert.equal(res.status, 'VOIDED');
      assert.equal(res.alreadyVoided, false);
      assert.equal(updateArgs.data.voidReason, 'Error de digitación en mostrador');
      assert.equal(updateArgs.data.voidedBy, cashierId);
    });

    it('voidInvoice es idempotente: un segundo llamado responde alreadyVoided=true sin reescribir auditoría', async () => {
      let updateCallCount = 0;
      const alreadyVoidedInvoice = {
        id: 'inv-void-2',
        status: 'VOIDED',
        voidReason: 'Motivo original',
        voidedBy: 'cajero-original',
        voidedAt: new Date('2026-10-21T12:00:00Z'),
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb({
          $executeRawUnsafe: async () => {},
          invoice: {
            findUnique: async () => alreadyVoidedInvoice,
            update: async () => {
              updateCallCount++;
              return alreadyVoidedInvoice;
            },
          },
        }),
      } as any;

      const service = new InvoiceService(mockPrisma);
      const res = await service.voidInvoice(tenantId, 'inv-void-2', cashierId, {
        reason: 'Intento duplicado de anulación',
      });

      assert.equal(res.status, 'VOIDED');
      assert.equal(res.alreadyVoided, true);
      assert.equal(res.voidReason, 'Motivo original');
      assert.equal(updateCallCount, 0, 'No debe ejecutar UPDATE en la base de datos');
    });

    it('voidInvoice rechaza solicitudes sin motivo de anulación', async () => {
      const mockPrisma = {} as any;
      const service = new InvoiceService(mockPrisma);

      await assert.rejects(
        async () => service.voidInvoice(tenantId, 'inv-void-3', cashierId, { reason: '' }),
        (err: any) => err instanceof BadRequestException,
      );
    });

    it('voidInvoice responde 404 NotFound si la factura no existe o no pertenece al tenant', async () => {
      const mockPrisma = {
        $transaction: async (cb: any) => cb({
          $executeRawUnsafe: async () => {},
          invoice: {
            findUnique: async () => null,
          },
        }),
      } as any;

      const service = new InvoiceService(mockPrisma);

      await assert.rejects(
        async () => service.voidInvoice(tenantId, 'inv-inexistente', cashierId, {
          reason: 'Prueba 404',
        }),
        (err: any) => err instanceof NotFoundException,
      );
    });
  });
});

