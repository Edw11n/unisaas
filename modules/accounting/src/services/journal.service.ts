import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreateJournalEntryDto } from '../dto/accounting.dto.js';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaClient) {}

  async getJournalEntries(tenantId: string, branchId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.journalEntry.findMany({
        where: branchId ? { branchId } : undefined,
        include: {
          lines: {
            include: { account: true, thirdParty: true },
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { entryDate: 'desc' },
        take: 50,
      });
    });
  }

  async getJournalEntryById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: {
          lines: {
            include: { account: true, thirdParty: true },
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
          reversalEntry: true,
        },
      });

      if (!entry) {
        throw new NotFoundException(`Asiento contable con ID ${id} no encontrado`);
      }

      return entry;
    });
  }

  async createJournalEntry(tenantId: string, userId: string, dto: CreateJournalEntryDto) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('Un asiento contable por partida doble requiere al menos 2 líneas');
    }

    // 1. Enforzar balance estricto: Sum(Debit) == Sum(Credit) usando Money
    let totalDebit = Money.zero();
    let totalCredit = Money.zero();

    const preparedLines = dto.lines.map((l) => {
      const debitMoney = Money.from(l.debit || 0);
      const creditMoney = Money.from(l.credit || 0);

      totalDebit = totalDebit.add(debitMoney);
      totalCredit = totalCredit.add(creditMoney);

      return {
        id: randomUUID(),
        tenantId,
        accountId: l.accountId,
        thirdPartyId: l.thirdPartyId || null,
        debit: debitMoney.toNumber(),
        credit: creditMoney.toNumber(),
        description: l.description || null,
        nature: l.nature || (debitMoney.isPositive() ? ('D' as const) : ('C' as const)),
      };
    });

    if (totalDebit.isZero()) {
      throw new BadRequestException('El asiento contable no puede tener un monto total en cero');
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Asiento contable descuadrado: Total Débito ($${totalDebit.toString()}) != Total Crédito ($${totalCredit.toString()})`,
      );
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 2. Obtener correlativo de asiento
      const lastEntry = await tx.journalEntry.findFirst({
        orderBy: { entryNumber: 'desc' },
        select: { entryNumber: true },
      });

      const nextNumber = lastEntry ? BigInt(lastEntry.entryNumber) + 1n : 1n;
      const entryId = randomUUID();

      return tx.journalEntry.create({
        data: {
          id: entryId,
          tenantId,
          branchId: dto.branchId,
          entryNumber: nextNumber,
          entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
          concept: dto.concept,
          sourceDocumentType: dto.sourceDocumentType,
          sourceDocumentId: dto.sourceDocumentId || null,
          totalDebit: totalDebit.toNumber(),
          totalCredit: totalCredit.toNumber(),
          isReversed: false,
          createdById: userId,
          lines: {
            create: preparedLines,
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });
    });
  }

  async reverseJournalEntry(tenantId: string, entryId: string, userId: string, reason: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const original = await tx.journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: true },
      });

      if (!original) {
        throw new NotFoundException(`Asiento contable con ID ${entryId} no encontrado`);
      }

      if (original.isReversed) {
        throw new ConflictException('Este asiento contable ya ha sido reversado previamente');
      }

      const lastEntry = await tx.journalEntry.findFirst({
        orderBy: { entryNumber: 'desc' },
        select: { entryNumber: true },
      });

      const nextNumber = lastEntry ? BigInt(lastEntry.entryNumber) + 1n : 1n;
      const reversalId = randomUUID();

      // Invertir débito y crédito
      const reversedLines = original.lines.map((l) => ({
        id: randomUUID(),
        tenantId,
        accountId: l.accountId,
        thirdPartyId: l.thirdPartyId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        description: `Reverso de línea: ${l.description || original.concept}`,
        nature: l.nature === 'D' ? ('C' as const) : ('D' as const),
      }));

      const reversalEntry = await tx.journalEntry.create({
        data: {
          id: reversalId,
          tenantId,
          branchId: original.branchId,
          entryNumber: nextNumber,
          entryDate: new Date(),
          concept: `Reverso de asiento #${original.entryNumber}: ${reason}`,
          sourceDocumentType: 'REVERSAL',
          sourceDocumentId: original.id,
          totalDebit: Number(original.totalCredit),
          totalCredit: Number(original.totalDebit),
          isReversed: false,
          createdById: userId,
          lines: {
            create: reversedLines,
          },
        },
      });

      // Marcar original como reversado
      await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          isReversed: true,
          reversalEntryId: reversalId,
        },
      });

      return reversalEntry;
    });
  }
}

