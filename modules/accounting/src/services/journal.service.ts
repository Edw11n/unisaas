import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type {
  CreateJournalEntryDto,
  ManualEntryDto,
  ReversalEntryDto,
  SalesPosCausationDto,
} from '../dto/accounting.dto.js';
import { SalesPosCausationBuilder } from '../domain/sales-pos-causation.builder.js';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Consulta paginada del libro diario con filtros opcionales.
   */
  async getJournalEntries(
    tenantId: string,
    filters?: {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      sourceDocumentType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const where: any = {};

      if (filters?.branchId) {
        where.branchId = filters.branchId;
      }
      if (filters?.sourceDocumentType) {
        where.sourceDocumentType = filters.sourceDocumentType;
      }
      if (filters?.startDate || filters?.endDate) {
        where.entryDate = {};
        if (filters.startDate) {
          where.entryDate.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.entryDate.lte = new Date(filters.endDate);
        }
      }

      const take = filters?.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
      const skip = filters?.offset ? Math.max(filters.offset, 0) : 0;

      return tx.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: true, thirdParty: true },
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { entryNumber: 'desc' },
        take,
        skip,
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

  /**
   * Registro atómico de asiento por partida doble.
   */
  async createJournalEntry(tenantId: string, userId: string, dto: CreateJournalEntryDto) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('Un asiento contable por partida doble requiere al menos 2 líneas');
    }

    // 0. Enforzar balance estricto: Sum(Debit) == Sum(Credit) usando Money antes de abrir transacción
    let checkDebit = Money.zero();
    let checkCredit = Money.zero();
    for (const l of dto.lines) {
      checkDebit = checkDebit.add(Money.from(l.debit || 0));
      checkCredit = checkCredit.add(Money.from(l.credit || 0));
    }

    if (checkDebit.isZero()) {
      throw new BadRequestException('El asiento contable no puede tener un monto total en cero');
    }

    if (!checkDebit.equals(checkCredit)) {
      throw new BadRequestException(
        `Asiento contable descuadrado: Total Débitos ($${checkDebit.toString()}) != Total Créditos ($${checkCredit.toString()})`,
      );
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      let totalDebit = Money.zero();
      let totalCredit = Money.zero();
      const preparedLines: any[] = [];

      for (const l of dto.lines) {
        let account = null;
        if (tx.chartOfAccount) {
          if (l.accountId) {
            account = await tx.chartOfAccount.findUnique({
              where: { id: l.accountId },
            });
          } else if (l.accountCode) {
            account = await tx.chartOfAccount.findFirst({
              where: { code: l.accountCode },
            });
          }
        } else {
          account = {
            id: l.accountId || randomUUID(),
            code: l.accountCode || '110505',
            name: 'Cuenta Auxiliar',
            isSelectable: true,
            isActive: true,
          };
        }

        if (!account) {
          throw new NotFoundException(
            `Cuenta contable PUC no encontrada: ${l.accountCode || l.accountId}`,
          );
        }

        if (!account.isSelectable || !account.isActive) {
          throw new BadRequestException(
            `La cuenta ${account.code} - ${account.name} no es imputable para transacciones o está inactiva`,
          );
        }

        const debitMoney = Money.from(l.debit || 0);
        const creditMoney = Money.from(l.credit || 0);

        totalDebit = totalDebit.add(debitMoney);
        totalCredit = totalCredit.add(creditMoney);

        preparedLines.push({
          id: randomUUID(),
          tenantId,
          accountId: account.id,
          thirdPartyId: l.thirdPartyId || null,
          debit: debitMoney.toNumber(),
          credit: creditMoney.toNumber(),
          description: l.description || null,
          nature: l.nature || (debitMoney.isPositive() ? ('D' as const) : ('C' as const)),
        });
      }

      if (totalDebit.isZero()) {
        throw new BadRequestException('El asiento contable no puede tener un monto total en cero');
      }

      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `Asiento contable descuadrado: Total Débito ($${totalDebit.toString()}) != Total Crédito ($${totalCredit.toString()})`,
        );
      }

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

  /**
   * Asiento manual de ajuste.
   */
  async createManualEntry(tenantId: string, userId: string, dto: ManualEntryDto) {
    return this.createJournalEntry(tenantId, userId, {
      branchId: dto.branchId,
      concept: dto.concept,
      entryDate: dto.entryDate,
      sourceDocumentType: 'MANUAL_ADJUSTMENT',
      sourceDocumentId: undefined,
      lines: dto.lines,
    });
  }

  /**
   * Reversión de asiento existente generando contra-asiento exacto.
   */
  async reverseJournalEntry(
    tenantId: string,
    identifier: { entryId?: string; entryNumber?: number | string | bigint },
    userId: string,
    reason: string,
  ) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      let original: any = null;

      if (identifier.entryId) {
        original = await tx.journalEntry.findUnique({
          where: { id: identifier.entryId },
          include: { lines: true },
        });
      } else if (identifier.entryNumber !== undefined) {
        original = await tx.journalEntry.findFirst({
          where: { entryNumber: BigInt(identifier.entryNumber) },
          include: { lines: true },
        });
      }

      if (!original) {
        throw new NotFoundException('Asiento contable original no encontrado para anulación/reversión');
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
      const reversedLines = original.lines.map((l: any) => ({
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
          concept: `Reverso de asiento #${original.entryNumber}: ${reason || 'Anulación de asiento'}`,
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
        where: { id: original.id },
        data: {
          isReversed: true,
          reversalEntryId: reversalId,
        },
      });

      return reversalEntry;
    });
  }

  /**
   * Causación contable automática de ventas POS con garantía de idempotencia.
   */
  async causeSalesPos(tenantId: string, userId: string, dto: SalesPosCausationDto) {
    // 1. Garantía de idempotencia: Si ya existe asiento para esta factura POS, retornarlo
    const existing = await withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.journalEntry.findFirst({
        where: {
          sourceDocumentType: 'SALE_POS',
          sourceDocumentId: dto.invoiceId,
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });
    });

    if (existing) {
      return existing;
    }

    // 2. Construir líneas bajo NIIF / PUC colombiano
    const { concept, lines } = SalesPosCausationBuilder.build({
      invoiceId: dto.invoiceId,
      invoiceConsecutive: dto.invoiceConsecutive,
      branchId: dto.branchId,
      customerId: dto.customerId,
      paymentMethod: dto.paymentMethod,
      subtotal: dto.subtotal,
      taxAmount: dto.taxAmount,
      total: dto.total,
      costOfGoodsSold: dto.costOfGoodsSold,
    });

    return this.createJournalEntry(tenantId, userId, {
      branchId: dto.branchId,
      concept,
      sourceDocumentType: 'SALE_POS',
      sourceDocumentId: dto.invoiceId,
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        thirdPartyId: l.thirdPartyId || undefined,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        nature: l.nature,
      })),
    });
  }
}
