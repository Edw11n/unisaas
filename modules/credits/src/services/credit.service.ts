import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreditTransactionDto } from '../dto/credits.dto.js';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaClient) {}

  async getCreditHistory(tenantId: string, thirdPartyId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.creditTransaction.findMany({
        where: { thirdPartyId },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async registerTransaction(tenantId: string, userId: string, dto: CreditTransactionDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('El monto de la transacción de crédito debe ser estrictamente positivo');
    }
    const txAmount = Money.from(dto.amount);

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const thirdParty = await tx.thirdParty.findUnique({
        where: { id: dto.thirdPartyId },
      });

      if (!thirdParty) {
        throw new NotFoundException(`Tercero con ID ${dto.thirdPartyId} no encontrado`);
      }

      const prevDebt = Money.from(thirdParty.currentDebt.toString());
      const creditLimit = Money.from(thirdParty.creditLimit.toString());
      let newDebt: Money;

      switch (dto.type) {
        case 'CHARGE_CREDIT_SALE': {
          // Venta fiada / a crédito al cliente: aumenta su deuda
          newDebt = prevDebt.add(txAmount);
          if (creditLimit.isPositive() && newDebt.greaterThan(creditLimit)) {
            throw new BadRequestException(
              `El cupo de crédito otorgado al cliente ($${creditLimit.toString()}) ha sido excedido con esta compra ($${newDebt.toString()})`,
            );
          }
          break;
        }

        case 'CUSTOMER_PAYMENT': {
          // Abono / pago de cliente a su deuda
          if (txAmount.greaterThan(prevDebt)) {
            throw new BadRequestException(
              `El abono ($${txAmount.toString()}) no puede exceder la deuda total actual del cliente ($${prevDebt.toString()})`,
            );
          }
          newDebt = prevDebt.subtract(txAmount);
          break;
        }

        case 'SUPPLIER_PURCHASE': {
          // Compra a crédito al proveedor: aumenta cuenta por pagar
          newDebt = prevDebt.add(txAmount);
          break;
        }

        case 'SUPPLIER_PAYMENT': {
          // Pago realizado al proveedor: reduce cuenta por pagar
          if (txAmount.greaterThan(prevDebt)) {
            throw new BadRequestException(
              `El pago al proveedor ($${txAmount.toString()}) no puede exceder el saldo pendiente ($${prevDebt.toString()})`,
            );
          }
          newDebt = prevDebt.subtract(txAmount);
          break;
        }

        default:
          throw new BadRequestException(`Tipo de transacción de crédito no soportado: ${dto.type}`);
      }

      // Actualizar deuda en el tercero
      await tx.thirdParty.update({
        where: { id: dto.thirdPartyId },
        data: { currentDebt: newDebt.toNumber() },
      });

      // Crear transacción en el libro de créditos
      const transaction = await tx.creditTransaction.create({
        data: {
          id: randomUUID(),
          tenantId,
          thirdPartyId: dto.thirdPartyId,
          type: dto.type,
          amount: txAmount.toNumber(),
          previousBalance: prevDebt.toNumber(),
          newBalance: newDebt.toNumber(),
          paymentMethod: dto.paymentMethod || 'EFECTIVO',
          referenceNumber: dto.referenceNumber || null,
          createdById: userId,
        },
      });

      return {
        transaction,
        currentDebt: newDebt.toNumber(),
        creditLimit: creditLimit.toNumber(),
      };
    });
  }
}

