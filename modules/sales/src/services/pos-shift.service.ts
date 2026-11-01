import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { OpenShiftDto, CloseShiftDto } from '../dto/sales.dto.js';

@Injectable()
export class PosShiftService {
  constructor(private readonly prisma: PrismaClient) {}

  async openShift(tenantId: string, cashierId: string, dto: OpenShiftDto) {
    const initialCash = Money.from(dto.initialCash);

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // Verificar si el cajero ya tiene un turno abierto en esta sucursal
      const existingOpen = await tx.posShift.findFirst({
        where: {
          branchId: dto.branchId,
          cashierId,
          status: 'OPEN',
        },
      });

      if (existingOpen) {
        throw new ConflictException('El cajero ya tiene un turno de caja abierto en esta sucursal');
      }

      // Obtener el siguiente número correlativo de turno para el tenant
      const lastShift = await tx.posShift.findFirst({
        orderBy: { shiftNumber: 'desc' },
        select: { shiftNumber: true },
      });

      const nextShiftNumber = lastShift ? BigInt(lastShift.shiftNumber) + 1n : 1n;

      return tx.posShift.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: dto.branchId,
          cashierId,
          shiftNumber: nextShiftNumber,
          initialCash: initialCash.toNumber(),
          totalSales: 0,
          totalCashSales: 0,
          totalDigitalSales: 0,
          totalCreditSales: 0,
          status: 'OPEN',
        },
        include: {
          cashier: {
            select: { id: true, fullName: true, email: true },
          },
          branch: true,
        },
      });
    });
  }

  async closeShift(tenantId: string, shiftId: string, closedById: string, dto: CloseShiftDto) {
    const actualCash = Money.from(dto.actualCash);

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const shift = await tx.posShift.findUnique({
        where: { id: shiftId },
      });

      if (!shift) {
        throw new NotFoundException(`Turno de caja con ID ${shiftId} no encontrado`);
      }

      if (shift.status !== 'OPEN') {
        throw new BadRequestException('El turno ya fue cerrado o conciliado previamente');
      }

      const initial = Money.from(shift.initialCash.toString());
      const cashSales = Money.from(shift.totalCashSales.toString());
      const expectedCash = initial.add(cashSales);
      const difference = actualCash.subtract(expectedCash, true); // Permite negativos si hay faltante

      return tx.posShift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          actualCash: actualCash.toNumber(),
          expectedCash: expectedCash.toNumber(),
          difference: difference.toNumber(),
          closingTime: new Date(),
          closedById,
        },
        include: {
          cashier: { select: { id: true, fullName: true, email: true } },
          closedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
    });
  }

  async getCurrentShift(tenantId: string, branchId: string, cashierId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const shift = await tx.posShift.findFirst({
        where: {
          branchId,
          cashierId,
          status: 'OPEN',
        },
        include: {
          cashier: { select: { id: true, fullName: true, email: true } },
          branch: true,
        },
      });

      return shift;
    });
  }

  async getShifts(tenantId: string, branchId?: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.posShift.findMany({
        where: branchId ? { branchId } : undefined,
        orderBy: { openingTime: 'desc' },
        take: 50,
        include: {
          cashier: { select: { id: true, fullName: true, email: true } },
          closedBy: { select: { id: true, fullName: true, email: true } },
        },
      });
    });
  }
}
