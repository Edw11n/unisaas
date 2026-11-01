import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import type { CreateTenantDto, CreateBranchDto } from '../dto/auth.dto.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Obtiene la información general de la empresa.
   */
  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Inquilino con ID ${tenantId} no encontrado`);
    }

    return tenant;
  }

  /**
   * Lista las sucursales del inquilino bajo aislamiento RLS estricto.
   */
  async getBranches(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.branch.findMany({
        orderBy: { code: 'asc' },
      });
    });
  }

  /**
   * Registra una nueva sucursal para el inquilino bajo aislamiento RLS estricto.
   */
  async createBranch(tenantId: string, dto: CreateBranchDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.branch.findFirst({
        where: { code: dto.code },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una sucursal con el código "${dto.code}"`);
      }

      return tx.branch.create({
        data: {
          id: randomUUID(),
          tenantId,
          code: dto.code,
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
          isActive: true,
        },
      });
    });
  }

  /**
   * Registro administrativo de nuevo inquilino (onboarding global).
   */
  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { nitRut: dto.nitRut },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una empresa registrada con el NIT/RUT "${dto.nitRut}"`);
    }

    const tenantId = randomUUID();

    return this.prisma.tenant.create({
      data: {
        id: tenantId,
        nitRut: dto.nitRut,
        businessName: dto.businessName,
        tradeName: dto.tradeName,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        countryCode: dto.countryCode || 'COL',
        currencyCode: dto.currencyCode || 'COP',
        taxRegime: dto.taxRegime || 'REGIMEN_SIMPLE',
        isActive: true,
      },
    });
  }
}

