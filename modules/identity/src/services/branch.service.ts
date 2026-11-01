import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import type { CreateBranchDto } from '../dto/auth.dto.js';
import type { UpdateBranchDto } from '../dto/identity-extended.dto.js';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.branch.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
    });
  }

  async findByIdentifier(tenantId: string, identifier: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const branch = await tx.branch.findFirst({
        where: {
          OR: [
            { id: identifier.includes('-') ? identifier : undefined },
            { code: identifier },
            { name: identifier },
          ],
        },
      });

      if (!branch) {
        throw new NotFoundException(`Sucursal "${identifier}" no encontrada.`);
      }
      return branch;
    });
  }

  async create(tenantId: string, dto: CreateBranchDto) {
    const code = dto.code || 'BR-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.branch.findFirst({
        where: { code },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una sucursal con el código "${code}"`);
      }

      return tx.branch.create({
        data: {
          id: randomUUID(),
          tenantId,
          code,
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
          isActive: true,
        },
      });
    });
  }

  async update(tenantId: string, identifier: string, dto: UpdateBranchDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.branch.findFirst({
        where: {
          OR: [
            { id: identifier.includes('-') ? identifier : undefined },
            { code: identifier },
          ],
        },
      });

      if (!existing) {
        throw new NotFoundException(`Sucursal "${identifier}" no encontrada para actualizar.`);
      }

      return tx.branch.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          address: dto.address ?? existing.address,
          phone: dto.phone ?? existing.phone,
          isActive: dto.isActive ?? existing.isActive,
        },
      });
    });
  }

  async softDelete(tenantId: string, identifier: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.branch.findFirst({
        where: {
          OR: [
            { id: identifier.includes('-') ? identifier : undefined },
            { code: identifier },
          ],
        },
      });

      if (!existing) {
        throw new NotFoundException(`Sucursal "${identifier}" no encontrada para eliminar.`);
      }

      return tx.branch.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    });
  }
}
