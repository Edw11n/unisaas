import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreateThirdPartyDto } from '../dto/credits.dto.js';

@Injectable()
export class ThirdPartyService {
  constructor(private readonly prisma: PrismaClient) {}

  async getThirdParties(tenantId: string, partyType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH') {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.thirdParty.findMany({
        where: {
          isActive: true,
          partyType: partyType ? { in: [partyType, 'BOTH'] } : undefined,
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  async getThirdPartyById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const party = await tx.thirdParty.findUnique({
        where: { id },
        include: {
          creditTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!party) {
        throw new NotFoundException(`Tercero con ID ${id} no encontrado`);
      }

      return party;
    });
  }

  async createThirdParty(tenantId: string, dto: CreateThirdPartyDto) {
    const limit = dto.creditLimit !== undefined ? Money.from(dto.creditLimit) : Money.zero();

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.thirdParty.findFirst({
        where: {
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe un tercero registrado con ${dto.documentType} ${dto.documentNumber}`,
        );
      }

      return tx.thirdParty.create({
        data: {
          id: randomUUID(),
          tenantId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          name: dto.name,
          phone: dto.phone || null,
          email: dto.email || null,
          address: dto.address || null,
          partyType: dto.partyType,
          creditLimit: limit.toNumber(),
          currentDebt: 0,
          isActive: true,
        },
      });
    });
  }
}

