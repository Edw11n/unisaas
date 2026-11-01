import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import type { CreateWarehouseDto } from '../dto/inventory.dto.js';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaClient) {}

  async getWarehouses(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.warehouse.findMany({
        where: { status: 'ACTIVE' },
        include: { branch: true },
        orderBy: { code: 'asc' },
      });
    });
  }

  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.warehouse.findFirst({
        where: { code: dto.code },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una bodega con el código "${dto.code}"`);
      }

      return tx.warehouse.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: dto.branchId,
          code: dto.code,
          name: dto.name,
          description: dto.address,
          status: 'ACTIVE',
        },
      });
    });
  }
}
