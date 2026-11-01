import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AccountService } from '../src/services/account.service.js';
import { JournalService } from '../src/services/journal.service.js';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('Módulo Contable, PUC y Partida Doble (@unisaas/accounting)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const branchId = 'b0000000-0000-0000-0000-000000000001';
  const userId = 'u0000000-0000-0000-0000-000000000001';

  it('AccountService.createAccount rechaza códigos PUC duplicados con ConflictException', async () => {
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findFirst: async () => ({ id: 'acc-1', code: '110505' }),
        },
      }),
    } as any;

    const service = new AccountService(mockPrisma);

    await assert.rejects(
      async () => service.createAccount(tenantId, {
        code: '110505',
        name: 'Caja General',
        accountType: 'ACTIVO',
        nature: 'D',
      }),
      (err: any) => err instanceof ConflictException,
    );
  });

  it('JournalService.createJournalEntry rechaza asientos descuadrados (Débito != Crédito)', async () => {
    const service = new JournalService({} as any);

    // Débito = 50.000, Crédito = 45.000 (Descuadre de 5.000)
    await assert.rejects(
      async () => service.createJournalEntry(tenantId, userId, {
        branchId,
        concept: 'Asiento Descuadrado',
        sourceDocumentType: 'MANUAL_ADJUSTMENT',
        lines: [
          { accountId: '00000000-0000-0000-0000-000000000001', debit: 50000, credit: 0 },
          { accountId: '00000000-0000-0000-0000-000000000002', debit: 0, credit: 45000 },
        ],
      }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('JournalService.createJournalEntry aprueba asientos cuadrados y persiste la partida doble', async () => {
    let createdEntry: any = null;

    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        journalEntry: {
          findFirst: async () => ({ entryNumber: 10n }),
          create: async (args: any) => {
            createdEntry = args.data;
            return { ...args.data, id: args.data.id };
          },
        },
      }),
    } as any;

    const service = new JournalService(mockPrisma);

    const result = await service.createJournalEntry(tenantId, userId, {
      branchId,
      concept: 'Venta contado POS',
      sourceDocumentType: 'SALE_POS',
      lines: [
        { accountId: '00000000-0000-0000-0000-000000000001', debit: 119000, credit: 0 }, // Caja
        { accountId: '00000000-0000-0000-0000-000000000002', debit: 0, credit: 100000 }, // Ingreso comercio
        { accountId: '00000000-0000-0000-0000-000000000003', debit: 0, credit: 19000 },  // IVA por pagar
      ],
    });

    assert.ok(result);
    assert.equal(createdEntry.entryNumber, 11n);
    assert.equal(createdEntry.totalDebit, 119000);
    assert.equal(createdEntry.totalCredit, 119000);
    assert.equal(createdEntry.lines.create.length, 3);
  });
});

