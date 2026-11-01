import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';

export interface TrialBalanceItem {
  accountCode: string;
  accountName: string;
  accountType: string;
  nature: string;
  debitMovement: number;
  creditMovement: number;
  finalDebitBalance: number;
  finalCreditBalance: number;
}

export interface FinancialStatementGroup {
  category: string;
  accounts: { code: string; name: string; balance: number }[];
  subtotal: number;
}

@Injectable()
export class LedgerReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Balance de Comprobación de sumas y saldos.
   */
  async getTrialBalance(tenantId: string, startDate?: string, endDate?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const lineDateFilter: any = {};
      if (startDate) {
        lineDateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        lineDateFilter.lte = new Date(endDate);
      }

      const hasDateFilter = startDate || endDate;

      const accounts = await tx.chartOfAccount.findMany({
        where: { isActive: true },
        include: {
          journalEntryLines: {
            where: {
              journalEntry: {
                isReversed: false,
                ...(hasDateFilter ? { entryDate: lineDateFilter } : {}),
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      });

      let sumDebits = Money.zero();
      let sumCredits = Money.zero();

      const items: TrialBalanceItem[] = [];

      for (const acc of accounts) {
        let accDebits = Money.zero();
        let accCredits = Money.zero();

        for (const line of acc.journalEntryLines) {
          accDebits = accDebits.add(Money.from(line.debit));
          accCredits = accCredits.add(Money.from(line.credit));
        }

        if (accDebits.isZero() && accCredits.isZero()) {
          continue;
        }

        sumDebits = sumDebits.add(accDebits);
        sumCredits = sumCredits.add(accCredits);

        const debNum = accDebits.toNumber();
        const credNum = accCredits.toNumber();
        const diff = debNum - credNum;
        const finalDebit = diff > 0 ? diff : 0;
        const finalCredit = diff < 0 ? Math.abs(diff) : 0;

        items.push({
          accountCode: acc.code,
          accountName: acc.name,
          accountType: acc.accountType,
          nature: acc.nature,
          debitMovement: accDebits.toNumber(),
          creditMovement: accCredits.toNumber(),
          finalDebitBalance: finalDebit,
          finalCreditBalance: finalCredit,
        });
      }

      return {
        tenantId,
        generatedAt: new Date(),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        accounts: items,
        totalDebits: sumDebits.toNumber(),
        totalCredits: sumCredits.toNumber(),
        isBalanced: sumDebits.equals(sumCredits),
      };
    });
  }

  /**
   * Balance General clasificado (Activo = Pasivo + Patrimonio).
   */
  async getBalanceSheet(tenantId: string, asOfDate?: string) {
    const trial = await this.getTrialBalance(tenantId, undefined, asOfDate);

    const assetAccounts: { code: string; name: string; balance: number }[] = [];
    const liabilityAccounts: { code: string; name: string; balance: number }[] = [];
    const equityAccounts: { code: string; name: string; balance: number }[] = [];

    let totalAssets = Money.zero();
    let totalLiabilities = Money.zero();
    let totalEquity = Money.zero();

    let totalRevenues = Money.zero();
    let totalCostsAndExpenses = Money.zero();

    for (const item of trial.accounts) {
      if (item.accountType === 'ACTIVO') {
        const bal = Money.from(item.finalDebitBalance).subtract(Money.from(item.finalCreditBalance), true);
        assetAccounts.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalAssets = totalAssets.add(bal);
      } else if (item.accountType === 'PASIVO') {
        const bal = Money.from(item.finalCreditBalance).subtract(Money.from(item.finalDebitBalance), true);
        liabilityAccounts.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalLiabilities = totalLiabilities.add(bal);
      } else if (item.accountType === 'PATRIMONIO') {
        const bal = Money.from(item.finalCreditBalance).subtract(Money.from(item.finalDebitBalance), true);
        equityAccounts.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalEquity = totalEquity.add(bal);
      } else if (item.accountType === 'INGRESO') {
        const bal = Money.from(item.finalCreditBalance).subtract(Money.from(item.finalDebitBalance), true);
        totalRevenues = totalRevenues.add(bal);
      } else if (item.accountType === 'GASTO' || item.accountType === 'COSTO') {
        const bal = Money.from(item.finalDebitBalance).subtract(Money.from(item.finalCreditBalance), true);
        totalCostsAndExpenses = totalCostsAndExpenses.add(bal);
      }
    }

    // Computar el resultado dinámico del ejercicio (P&G: Ingresos - Costos/Gastos)
    const currentPeriodEarnings = totalRevenues.subtract(totalCostsAndExpenses, true);
    if (!currentPeriodEarnings.isZero()) {
      equityAccounts.push({
        code: '360505',
        name: 'Resultado del Ejercicio Actual (P&G Dinámico)',
        balance: currentPeriodEarnings.toNumber(),
      });
      totalEquity = totalEquity.add(currentPeriodEarnings);
    }

    const assetsGroup: FinancialStatementGroup[] = [
      { category: 'Activos Totales', accounts: assetAccounts, subtotal: totalAssets.toNumber() },
    ];
    const liabilitiesGroup: FinancialStatementGroup[] = [
      { category: 'Pasivos Totales', accounts: liabilityAccounts, subtotal: totalLiabilities.toNumber() },
    ];
    const equityGroup: FinancialStatementGroup[] = [
      { category: 'Patrimonio Total', accounts: equityAccounts, subtotal: totalEquity.toNumber() },
    ];

    const rightSide = totalLiabilities.add(totalEquity);

    return {
      tenantId,
      asOfDate: asOfDate ? new Date(asOfDate) : new Date(),
      assets: assetsGroup,
      totalAssets: totalAssets.toNumber(),
      liabilities: liabilitiesGroup,
      totalLiabilities: totalLiabilities.toNumber(),
      equity: equityGroup,
      totalEquity: totalEquity.toNumber(),
      isBalanced: totalAssets.equals(rightSide),
    };
  }

  /**
   * Estado de Resultados (Pérdidas y Ganancias P&G).
   */
  async getIncomeStatement(tenantId: string, startDate?: string, endDate?: string) {
    const trial = await this.getTrialBalance(tenantId, startDate, endDate);

    const revAcc: { code: string; name: string; balance: number }[] = [];
    const costAcc: { code: string; name: string; balance: number }[] = [];
    const expAcc: { code: string; name: string; balance: number }[] = [];

    let totalRev = Money.zero();
    let totalCost = Money.zero();
    let totalExp = Money.zero();

    for (const item of trial.accounts) {
      if (item.accountType === 'INGRESO') {
        const bal = Money.from(item.finalCreditBalance).subtract(Money.from(item.finalDebitBalance), true);
        revAcc.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalRev = totalRev.add(bal);
      } else if (item.accountType === 'COSTO') {
        const bal = Money.from(item.finalDebitBalance).subtract(Money.from(item.finalCreditBalance), true);
        costAcc.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalCost = totalCost.add(bal);
      } else if (item.accountType === 'GASTO') {
        const bal = Money.from(item.finalDebitBalance).subtract(Money.from(item.finalCreditBalance), true);
        expAcc.push({ code: item.accountCode, name: item.accountName, balance: bal.toNumber() });
        totalExp = totalExp.add(bal);
      }
    }

    const grossProfit = totalRev.subtract(totalCost, true);
    const netProfit = grossProfit.subtract(totalExp, true);

    return {
      tenantId,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(),
      revenues: [{ category: 'Ingresos Operacionales', accounts: revAcc, subtotal: totalRev.toNumber() }],
      totalRevenues: totalRev.toNumber(),
      costs: [{ category: 'Costo de Ventas', accounts: costAcc, subtotal: totalCost.toNumber() }],
      totalCosts: totalCost.toNumber(),
      expenses: [{ category: 'Gastos de Operación', accounts: expAcc, subtotal: totalExp.toNumber() }],
      totalExpenses: totalExp.toNumber(),
      grossProfit: grossProfit.toNumber(),
      netProfit: netProfit.toNumber(),
    };
  }

  /**
   * Libro Auxiliar / Mayor de una cuenta PUC con saldo acumulado cronológico.
   */
  async getAccountLedger(
    tenantId: string,
    accountCode: string,
    startDate?: string,
    endDate?: string,
  ) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const account = await tx.chartOfAccount.findFirst({
        where: { code: accountCode },
      });

      if (!account) {
        throw new NotFoundException(`Cuenta PUC ${accountCode} no encontrada`);
      }

      // Saldo inicial previo a startDate
      let initialBalance = Money.zero();
      if (startDate) {
        const priorLines = await tx.journalEntryLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: {
              isReversed: false,
              entryDate: { lt: new Date(startDate) },
            },
          },
        });

        let initD = Money.zero();
        let initC = Money.zero();
        for (const l of priorLines) {
          initD = initD.add(Money.from(l.debit));
          initC = initC.add(Money.from(l.credit));
        }

        initialBalance = account.nature === 'D' ? initD.subtract(initC) : initC.subtract(initD);
      }

      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      const lines = await tx.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            isReversed: false,
            ...(startDate || endDate ? { entryDate: dateFilter } : {}),
          },
        },
        include: {
          journalEntry: true,
        },
        orderBy: [
          { journalEntry: { entryDate: 'asc' } },
          { journalEntry: { entryNumber: 'asc' } },
        ],
      });

      let running = initialBalance;
      let totalD = Money.zero();
      let totalC = Money.zero();

      const movements = lines.map((l) => {
        const d = Money.from(l.debit);
        const c = Money.from(l.credit);
        totalD = totalD.add(d);
        totalC = totalC.add(c);

        if (account.nature === 'D') {
          running = running.add(d).subtract(c);
        } else {
          running = running.add(c).subtract(d);
        }

        return {
          entryNumber: Number(l.journalEntry.entryNumber),
          entryDate: l.journalEntry.entryDate,
          concept: l.journalEntry.concept,
          sourceDocumentType: l.journalEntry.sourceDocumentType,
          sourceDocumentId: l.journalEntry.sourceDocumentId,
          description: l.description,
          thirdPartyId: l.thirdPartyId,
          debitAmount: d.toNumber(),
          creditAmount: c.toNumber(),
          runningBalance: running.toNumber(),
        };
      });

      return {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        nature: account.nature,
        initialBalance: initialBalance.toNumber(),
        totalDebits: totalD.toNumber(),
        totalCredits: totalC.toNumber(),
        finalBalance: running.toNumber(),
        movements,
      };
    });
  }
}
