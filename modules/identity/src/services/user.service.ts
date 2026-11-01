import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CreateUserDto } from '../dto/auth.dto.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Obtiene los usuarios del inquilino bajo aislamiento RLS estricto.
   */
  async getUsers(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.user.findMany({
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          documentType: true,
          documentNumber: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { fullName: 'asc' },
      });
    });
  }

  /**
   * Registra un nuevo usuario para el inquilino bajo aislamiento RLS estricto.
   */
  async createUser(tenantId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = randomUUID();

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: dto.email.trim().toLowerCase() },
      });

      if (existing) {
        throw new ConflictException(`Ya existe un usuario con el correo "${dto.email}"`);
      }

      return tx.user.create({
        data: {
          id: userId,
          tenantId,
          branchId: dto.branchId,
          documentType: dto.documentType || 'CC',
          documentNumber: dto.documentNumber,
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          role: dto.role,
          isActive: true,
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    });
  }
}

