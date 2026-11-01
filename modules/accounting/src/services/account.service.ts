import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import type { CreateAccountDto } from '../dto/accounting.dto.js';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAccounts(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.chartOfAccount.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
    });
  }

  async getAccountById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const account = await tx.chartOfAccount.findUnique({
        where: { id },
        include: { parent: true, children: true },
      });

      if (!account) {
        throw new NotFoundException(`Cuenta contable con ID ${id} no encontrada`);
      }

      return account;
    });
  }

  async createAccount(tenantId: string, dto: CreateAccountDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.chartOfAccount.findFirst({
        where: { code: dto.code },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una cuenta con el código PUC "${dto.code}"`);
      }

      return tx.chartOfAccount.create({
        data: {
          id: randomUUID(),
          tenantId,
          code: dto.code,
          name: dto.name,
          accountType: dto.accountType,
          nature: dto.nature,
          parentId: dto.parentId || null,
          isSelectable: dto.isSelectable ?? true,
          isActive: true,
        },
      });
    });
  }
}

