import { Injectable } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';

@Injectable()
export class LedgerReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async getTrialBalance(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // Consultar cuentas activas con sus líneas de asiento contabilizadas (no reversadas)
      const accounts = await tx.chartOfAccount.findMany({
        where: { isActive: true },
        include: {
          journalEntryLines: {
            where: {
              journalEntry: { isReversed: false },
            },
          },
        },
        orderBy: { code: 'asc' },
      });

      return accounts.map((acc) => {
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of acc.journalEntryLines) {
          totalDebit += Number(line.debit);
          totalCredit += Number(line.credit);
        }

        const balance = acc.nature === 'D'
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;

        return {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          nature: acc.nature,
          totalDebit,
          totalCredit,
          balance,
        };
      });
    });
  }
}

