import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ThirdPartyService } from '../src/services/third-party.service.js';
import { CreditService } from '../src/services/credit.service.js';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('Módulo de Terceros, Compras y Cartera / Créditos (@unisaas/credits)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const userId = 'u0000000-0000-0000-0000-000000000001';
  const thirdPartyId = 't0000000-0000-0000-0000-000000000001';

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
});

