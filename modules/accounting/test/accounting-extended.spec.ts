import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SalesPosCausationBuilder } from '../src/domain/sales-pos-causation.builder.js';
import { JournalService } from '../src/services/journal.service.js';
import { LedgerReportService } from '../src/services/ledger-report.service.js';
import { AccountService } from '../src/services/account.service.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_BRANCH_ID = '22222222-2222-4222-8222-222222222222';
const VALID_USER_ID = '33333333-3333-4333-8333-333333333333';
const VALID_INVOICE_ID = '44444444-4444-4444-8444-444444444444';

describe('Squad 2 — Cobertura Integral del Motor Contable, PUC y Reportes Financieros', () => {
  // 1. SalesPosCausationBuilder
  describe('Constructor de Causación de Ventas POS (SalesPosCausationBuilder)', () => {
    it('construye causación completa NIIF con Efectivo, IVA y Kardex', () => {
      const result = SalesPosCausationBuilder.build({
        invoiceId: VALID_INVOICE_ID,
        invoiceConsecutive: 'POS-001',
        branchId: VALID_BRANCH_ID,
        paymentMethod: 'EFECTIVO',
        subtotal: 100000,
        taxAmount: 19000,
        total: 119000,
        costOfGoodsSold: 60000,
      });

      assert.equal(result.concept, 'Venta POS Comprobante POS-001');
      assert.equal(result.lines.length, 5);

      // Línea 1: Caja General (110505) Débito 119.000
      assert.equal(result.lines[0].accountCode, '110505');
      assert.equal(result.lines[0].debit, 119000);
      assert.equal(result.lines[0].credit, 0);

      // Línea 2: Ingresos Comercio (413505) Crédito 100.000
      assert.equal(result.lines[1].accountCode, '413505');
      assert.equal(result.lines[1].debit, 0);
      assert.equal(result.lines[1].credit, 100000);

      // Línea 3: IVA Generado (240805) Crédito 19.000
      assert.equal(result.lines[2].accountCode, '240805');
      assert.equal(result.lines[2].debit, 0);
      assert.equal(result.lines[2].credit, 19000);

      // Línea 4: Costo de Ventas (613505) Débito 60.000
      assert.equal(result.lines[3].accountCode, '613505');
      assert.equal(result.lines[3].debit, 60000);
      assert.equal(result.lines[3].credit, 0);

      // Línea 5: Salida Inventario (143505) Crédito 60.000
      assert.equal(result.lines[4].accountCode, '143505');
      assert.equal(result.lines[4].debit, 0);
      assert.equal(result.lines[4].credit, 60000);
    });

    it('enruta pago digital a Moneda Nacional / Bancos (111005)', () => {
      const result = SalesPosCausationBuilder.build({
        invoiceId: VALID_INVOICE_ID,
        invoiceConsecutive: 'POS-002',
        branchId: VALID_BRANCH_ID,
        paymentMethod: 'NEQUI',
        subtotal: 50000,
        taxAmount: 9500,
        total: 59500,
      });

      assert.equal(result.lines[0].accountCode, '111005');
      assert.equal(result.lines[0].debit, 59500);
    });

    it('enruta venta a crédito / fiado a Clientes Nacionales (130505)', () => {
      const result = SalesPosCausationBuilder.build({
        invoiceId: VALID_INVOICE_ID,
        invoiceConsecutive: 'POS-003',
        branchId: VALID_BRANCH_ID,
        customerId: 'cust-123',
        paymentMethod: 'CREDITO_FIADO',
        subtotal: 20000,
        taxAmount: 0,
        total: 20000,
      });

      assert.equal(result.lines[0].accountCode, '130505');
      assert.equal(result.lines[0].thirdPartyId, 'cust-123');
      assert.equal(result.lines[0].debit, 20000);
    });

    it('genera ajuste al peso por redondeo favorable (Crédito 429595)', () => {
      const result = SalesPosCausationBuilder.build({
        invoiceId: VALID_INVOICE_ID,
        invoiceConsecutive: 'POS-004',
        branchId: VALID_BRANCH_ID,
        paymentMethod: 'EFECTIVO',
        subtotal: 100,
        taxAmount: 19,
        total: 119.5, // 0.50 COP mayor por redondeo
      });

      const roundLine = result.lines.find((l) => l.accountCode === '429595');
      assert.ok(roundLine, 'Debe incluir cuenta 429595');
      assert.equal(roundLine.credit, 0.5);
    });

    it('rechaza descuadres superiores a la tolerancia legal de $1.00 COP', () => {
      assert.throws(
        () =>
          SalesPosCausationBuilder.build({
            invoiceId: VALID_INVOICE_ID,
            invoiceConsecutive: 'POS-FAIL',
            branchId: VALID_BRANCH_ID,
            paymentMethod: 'EFECTIVO',
            subtotal: 100,
            taxAmount: 19,
            total: 150, // Descuadre de $31 COP > $1.00 COP
          }),
        (err: any) => err instanceof BadRequestException,
      );
    });
  });

  // 2. JournalService (Asientos manuales, reversiones e idempotencia)
  describe('Gestión de Asientos Contables (JournalService)', () => {
    it('rechaza cuentas contables no imputables o inactivas', async () => {
      const mockTx = {
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findUnique: async () => ({
            id: 'acc-mayor',
            code: '1105',
            name: 'Caja Mayor (No imputable)',
            isSelectable: false, // NO IMPUTABLE
            isActive: true,
          }),
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new JournalService(mockPrisma);

      await assert.rejects(
        async () =>
          service.createJournalEntry(VALID_TENANT_ID, VALID_USER_ID, {
            branchId: VALID_BRANCH_ID,
            concept: 'Intento con cuenta mayor',
            sourceDocumentType: 'MANUAL_ADJUSTMENT',
            lines: [
              { accountId: 'acc-mayor', debit: 1000, credit: 0 },
              { accountId: 'acc-mayor', debit: 0, credit: 1000 },
            ],
          }),
        (err: any) => err instanceof BadRequestException,
      );
    });

    it('genera reversión exacta con contra-asiento invertido', async () => {
      let createdReversal: any = null;
      let updatedOriginal: any = null;

      const mockTx = {
        $executeRawUnsafe: async () => {},
        journalEntry: {
          findUnique: async () => ({
            id: 'entry-orig',
            entryNumber: 100n,
            branchId: VALID_BRANCH_ID,
            concept: 'Asiento Original',
            totalDebit: 50000,
            totalCredit: 50000,
            isReversed: false,
            lines: [
              { id: 'l1', accountId: 'acc-1', debit: 50000, credit: 0, nature: 'D' },
              { id: 'l2', accountId: 'acc-2', debit: 0, credit: 50000, nature: 'C' },
            ],
          }),
          findFirst: async () => ({ entryNumber: 100n }),
          create: async ({ data }: any) => {
            createdReversal = data;
            return data;
          },
          update: async ({ data }: any) => {
            updatedOriginal = data;
            return data;
          },
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new JournalService(mockPrisma);

      const reversal = await service.reverseJournalEntry(
        VALID_TENANT_ID,
        { entryId: 'entry-orig' },
        VALID_USER_ID,
        'Error de digitación',
      );

      assert.ok(reversal);
      assert.equal(createdReversal.entryNumber, 101n);
      assert.equal(createdReversal.sourceDocumentType, 'REVERSAL');
      // Débitos y créditos invertidos
      assert.equal(createdReversal.lines.create[0].debit, 0);
      assert.equal(createdReversal.lines.create[0].credit, 50000);
      assert.equal(createdReversal.lines.create[1].debit, 50000);
      assert.equal(createdReversal.lines.create[1].credit, 0);
      // Original marcado como reversado
      assert.equal(updatedOriginal.isReversed, true);
    });

    it('causeSalesPos respeta la idempotencia retornando el asiento existente', async () => {
      const existingEntry = {
        id: 'entry-existing-pos',
        entryNumber: 45n,
        sourceDocumentType: 'SALE_POS',
        sourceDocumentId: VALID_INVOICE_ID,
      };

      const mockTx = {
        $executeRawUnsafe: async () => {},
        journalEntry: {
          findFirst: async () => existingEntry,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const service = new JournalService(mockPrisma);

      const res = await service.causeSalesPos(VALID_TENANT_ID, VALID_USER_ID, {
        invoiceId: VALID_INVOICE_ID,
        invoiceConsecutive: 'POS-045',
        branchId: VALID_BRANCH_ID,
        paymentMethod: 'EFECTIVO',
        subtotal: 10000,
        taxAmount: 1900,
        total: 11900,
      });

      assert.equal(res.id, 'entry-existing-pos');
    });
  });

  // 3. Informes Financieros y Estados
  describe('Estados Financieros y Reportes (LedgerReportService)', () => {
    it('genera Balance de Comprobación cuadrado', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          code: '110505',
          name: 'Caja General',
          accountType: 'ACTIVO',
          nature: 'D',
          journalEntryLines: [{ debit: 119000, credit: 0 }],
        },
        {
          id: 'acc-2',
          code: '413505',
          name: 'Comercio',
          accountType: 'INGRESO',
          nature: 'C',
          journalEntryLines: [{ debit: 0, credit: 100000 }],
        },
        {
          id: 'acc-3',
          code: '240805',
          name: 'IVA Generado',
          accountType: 'PASIVO',
          nature: 'C',
          journalEntryLines: [{ debit: 0, credit: 19000 }],
        },
      ];

      const mockTx = {
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findMany: async () => mockAccounts,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const reportService = new LedgerReportService(mockPrisma);
      const trial = await reportService.getTrialBalance(VALID_TENANT_ID);

      assert.equal(trial.isBalanced, true);
      assert.equal(trial.totalDebits, 119000);
      assert.equal(trial.totalCredits, 119000);
      assert.equal(trial.accounts.length, 3);
    });

    it('genera Balance General con validación de ecuación patrimonial A = P + P', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          code: '110505',
          name: 'Caja General',
          accountType: 'ACTIVO',
          nature: 'D',
          journalEntryLines: [{ debit: 119000, credit: 0 }],
        },
        {
          id: 'acc-2',
          code: '240805',
          name: 'IVA Generado',
          accountType: 'PASIVO',
          nature: 'C',
          journalEntryLines: [{ debit: 0, credit: 19000 }],
        },
        {
          id: 'acc-3',
          code: '413505',
          name: 'Comercio',
          accountType: 'INGRESO',
          nature: 'C',
          journalEntryLines: [{ debit: 0, credit: 100000 }],
        },
      ];

      const mockTx = {
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findMany: async () => mockAccounts,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const reportService = new LedgerReportService(mockPrisma);
      const sheet = await reportService.getBalanceSheet(VALID_TENANT_ID);

      assert.equal(sheet.totalAssets, 119000);
      assert.equal(sheet.totalLiabilities, 19000);
      // P&G dinámico de $100.000 se suma al Patrimonio
      assert.equal(sheet.totalEquity, 100000);
      assert.equal(sheet.isBalanced, true, 'Activo ($119k) debe igualar Pasivo + Patrimonio ($119k)');
    });

    it('genera Estado de Resultados con Utilidad Bruta y Neta', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          code: '413505',
          name: 'Comercio',
          accountType: 'INGRESO',
          nature: 'C',
          journalEntryLines: [{ debit: 0, credit: 100000 }],
        },
        {
          id: 'acc-2',
          code: '613505',
          name: 'Costo de Ventas',
          accountType: 'COSTO',
          nature: 'D',
          journalEntryLines: [{ debit: 60000, credit: 0 }],
        },
        {
          id: 'acc-3',
          code: '510506',
          name: 'Sueldos',
          accountType: 'GASTO',
          nature: 'D',
          journalEntryLines: [{ debit: 15000, credit: 0 }],
        },
      ];

      const mockTx = {
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findMany: async () => mockAccounts,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const reportService = new LedgerReportService(mockPrisma);
      const statement = await reportService.getIncomeStatement(VALID_TENANT_ID);

      assert.equal(statement.totalRevenues, 100000);
      assert.equal(statement.totalCosts, 60000);
      assert.equal(statement.totalExpenses, 15000);
      assert.equal(statement.grossProfit, 40000); // 100.000 - 60.000
      assert.equal(statement.netProfit, 25000);   // 40.000 - 15.000
    });

    it('calcula Libro Auxiliar / Mayor de cuenta con saldo acumulado cronológico', async () => {
      const mockAccount = {
        id: 'acc-caja',
        code: '110505',
        name: 'Caja General',
        accountType: 'ACTIVO',
        nature: 'D',
      };

      const mockLines = [
        {
          debit: 50000,
          credit: 0,
          description: 'Apertura',
          thirdPartyId: null,
          journalEntry: {
            entryNumber: 1n,
            entryDate: new Date('2026-01-01'),
            concept: 'Apertura',
            sourceDocumentType: 'OPENING_BALANCE',
            sourceDocumentId: null,
          },
        },
        {
          debit: 0,
          credit: 20000,
          description: 'Pago proveedor',
          thirdPartyId: null,
          journalEntry: {
            entryNumber: 2n,
            entryDate: new Date('2026-01-02'),
            concept: 'Pago',
            sourceDocumentType: 'SUPPLIER_PAYMENT',
            sourceDocumentId: null,
          },
        },
      ];

      const mockTx = {
        $executeRawUnsafe: async () => {},
        chartOfAccount: {
          findFirst: async () => mockAccount,
        },
        journalEntryLine: {
          findMany: async () => mockLines,
        },
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const reportService = new LedgerReportService(mockPrisma);
      const ledger = await reportService.getAccountLedger(VALID_TENANT_ID, '110505');

      assert.equal(ledger.accountCode, '110505');
      assert.equal(ledger.totalDebits, 50000);
      assert.equal(ledger.totalCredits, 20000);
      assert.equal(ledger.finalBalance, 30000);
      assert.equal(ledger.movements[0].runningBalance, 50000);
      assert.equal(ledger.movements[1].runningBalance, 30000);
    });
  });
});
