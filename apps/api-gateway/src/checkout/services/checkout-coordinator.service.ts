import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, Quantity, TaxRate } from '@unisaas/core-domain';
import { EscPosBuilder } from '@unisaas/escpos';
import { IdempotencyLockService } from '@unisaas/redis-client';
import { IdempotencyService } from './idempotency.service.js';
import { OutboxProcessorService } from './outbox-processor.service.js';
import type { CheckoutDto, CheckoutResponseDto } from '../dto/checkout.dto.js';

@Injectable()
export class CheckoutCoordinatorService {
  private readonly logger = new Logger(CheckoutCoordinatorService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly idempotencyService: IdempotencyService,
    private readonly outboxProcessorService: OutboxProcessorService,
    private readonly idempotencyLockService: IdempotencyLockService,
  ) {}

  /**
   * Resuelve o aprovisiona una cuenta contable en el PUC del tenant.
   */
  private async getOrCreateAccount(
    tx: any,
    tenantId: string,
    code: string,
    name: string,
    accountType: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO',
    nature: 'D' | 'C',
  ): Promise<string> {
    const existing = await tx.chartOfAccount.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code,
        },
      },
    });

    if (existing) {
      return existing.id;
    }

    const created = await tx.chartOfAccount.create({
      data: {
        id: randomUUID(),
        tenantId,
        code,
        name,
        accountType,
        nature,
        isSelectable: true,
        isActive: true,
      },
    });

    return created.id;
  }

  /**
   * Obtiene el siguiente valor secuencial atómico y correlativo para una secuencia del tenant
   * mediante INSERT ... ON CONFLICT DO UPDATE RETURNING sobre la tabla tenant_sequences.
   * Participa en la transacción interactiva 'tx' garantizando atomicidad y rollback limpio.
   */
  private async getNextSequenceValue(
    tx: any,
    tenantId: string,
    sequenceKey: string,
  ): Promise<bigint> {
    const result: any[] = await tx.$queryRawUnsafe(
      `INSERT INTO tenant_sequences (id, tenant_id, sequence_key, current_value)
       VALUES ($1::uuid, $2::uuid, $3, 1)
       ON CONFLICT (tenant_id, sequence_key)
       DO UPDATE SET current_value = tenant_sequences.current_value + 1
       RETURNING current_value;`,
      randomUUID(),
      tenantId,
      sequenceKey,
    );

    const rawVal = result[0]?.current_value;
    return typeof rawVal === 'bigint' ? rawVal : BigInt(rawVal ?? 1);
  }

  /**
   * Ejecuta la orquestación atómica de Checkout POS en tres fases:
   * 1. Reserva durable de idempotencia (PostgreSQL + Redis auxiliar).
   * 2. Transacción interactiva ACID en PostgreSQL (Factura, Stock FOR UPDATE, Kardex CPP, Asiento Contable, Outbox y Auditoría).
   * 3. Efectos post-commit garantizados (impresión ESC/POS y despacho Outbox).
   */
  async executeCheckout(
    tenantId: string,
    userId: string,
    idempotencyKey: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('El encabezado Idempotency-Key es obligatorio para el checkout');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El checkout debe contener al menos un producto');
    }

    // ========================================================================
    // FASE 1: RESERVA DE IDEMPOTENCIA Y CONTROL DE CONCURRENCIA
    // ========================================================================
    const requestHash = this.idempotencyService.computeHash(dto);

    // Adquisición auxiliar en Redis (acelerador transitorio)
    let redisLock: { release: () => Promise<boolean> } | null = null;
    try {
      const lockRes = await this.idempotencyLockService.acquireLock(tenantId, idempotencyKey, 30);
      if (lockRes.acquired) {
        redisLock = lockRes;
      }
    } catch (err: any) {
      this.logger.warn(`Redis lock no disponible (${err.message}). Continuando con PostgreSQL como autoridad final.`);
    }

    // Reserva durable en PostgreSQL
    const lease = await this.idempotencyService.reserveLease(
      tenantId,
      idempotencyKey,
      'CHECKOUT_POS',
      requestHash,
    );

    if (lease.status === 'REPLAY') {
      if (redisLock) {
        await redisLock.release();
      }
      return {
        ...lease.responseBody,
        isReplay: true,
      };
    }

    const recoveryCount = lease.recoveryCount;

    // ========================================================================
    // FASE 2: TRANSACCIÓN INTERACTIVA ACID EN POSTGRESQL (withTenantContext)
    // ========================================================================
    let checkoutResult: CheckoutResponseDto;
    let outboxEventId: string;

    try {
      checkoutResult = await withTenantContext(this.prisma, tenantId, async (tx) => {
        // 1. Bloqueo pesimista (FOR UPDATE) y verificación de stock para cada variante
        const balancesToUpdate: Array<{
          balanceId: string;
          variantId: string;
          productId: string;
          productName: string;
          productSku: string;
          unitOfMeasureId: string;
          requestedQty: number;
          currentQty: number;
          averageCost: number;
          newQty: number;
          newAverageCost: number;
          newInventoryValue: number;
          itemGross: Money;
          itemNet: Money;
          itemTax: Money;
          itemDiscount: Money;
          itemTotal: Money;
          itemCost: Money;
          taxRatePercent: number;
          discountRatePercent: number;
          price: Money;
        }> = [];

        let runningSubtotal = Money.zero();
        let runningTaxTotal = Money.zero();
        let runningDiscountTotal = Money.zero();
        let totalCost = Money.zero();

        for (const item of dto.items) {
          const qty = Quantity.from(item.quantity);
          const price = Money.from(item.unitPrice);
          const taxRate = item.taxRate !== undefined ? TaxRate.from(item.taxRate) : TaxRate.from(19);
          const discountRate = item.discountRate ? TaxRate.from(item.discountRate) : TaxRate.zero();

          // Consultar variante
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });

          if (!variant) {
            throw new NotFoundException(`Variante de producto con ID ${item.variantId} no encontrada`);
          }

          // Bloqueo pesimista en la tabla de inventarios
          const balances: any[] = await tx.$queryRawUnsafe(
            `SELECT id, quantity_on_hand, average_cost, inventory_value
             FROM inventory_balances
             WHERE tenant_id = $1::uuid
               AND variant_id = $2::uuid
               AND warehouse_id = $3::uuid
             FOR UPDATE`,
            tenantId,
            item.variantId,
            item.warehouseId,
          );

          if (!balances || balances.length === 0) {
            throw new ConflictException(
              `No existe registro de inventario para la variante "${variant.name}" en la bodega especificada`,
            );
          }

          const bal = balances[0];
          const currentOnHand = Number(bal.quantity_on_hand);
          const currentAvgCost = Number(bal.average_cost);

          if (currentOnHand < qty.toNumber()) {
            throw new ConflictException(
              `Stock insuficiente para "${variant.name}". Disponible: ${currentOnHand}, Requerido: ${qty.toNumber()}`,
            );
          }

          const itemGross = price.multiply(qty.toNumber());
          const itemDiscount = discountRate.calculateTax(itemGross);
          const itemNet = itemGross.subtract(itemDiscount);
          const itemTax = taxRate.calculateTax(itemNet);
          const itemTotal = itemNet.add(itemTax);

          const itemCost = Money.from(currentAvgCost).multiply(qty.toNumber());

          runningSubtotal = runningSubtotal.add(itemNet);
          runningTaxTotal = runningTaxTotal.add(itemTax);
          runningDiscountTotal = runningDiscountTotal.add(itemDiscount);
          totalCost = totalCost.add(itemCost);

          const newQty = currentOnHand - qty.toNumber();
          const newAvgCost = currentAvgCost;
          const newInventoryValue = newQty * newAvgCost;

          balancesToUpdate.push({
            balanceId: bal.id,
            variantId: variant.id,
            productId: variant.productId,
            productName: variant.name,
            productSku: variant.sku,
            unitOfMeasureId: variant.unitOfMeasureId,
            requestedQty: qty.toNumber(),
            currentQty: currentOnHand,
            averageCost: currentAvgCost,
            newQty,
            newAverageCost: newAvgCost,
            newInventoryValue,
            itemGross,
            itemNet,
            itemTax,
            itemDiscount,
            itemTotal,
            itemCost,
            taxRatePercent: taxRate.percentage,
            discountRatePercent: discountRate.percentage,
            price,
          });
        }

        const grandTotal = runningSubtotal.add(runningTaxTotal);

        // 2. Validación de medio de pago
        let cashTenderedNum: number | null = null;
        let changeGivenNum: number | null = null;

        if (dto.payment.method === 'EFECTIVO') {
          if (dto.payment.cashTendered === undefined) {
            throw new BadRequestException('Debe indicar el efectivo entregado por el cliente');
          }
          const tendered = Money.from(dto.payment.cashTendered);
          if (tendered.lessThan(grandTotal)) {
            throw new BadRequestException(
              `El efectivo recibido ($${tendered.toString()}) es insuficiente para pagar el total ($${grandTotal.toString()})`,
            );
          }
          cashTenderedNum = tendered.toNumber();
          changeGivenNum = tendered.subtract(grandTotal).toNumber();
        }

        // Si es venta a crédito (fiado), validar y bloquear cliente
        let customerRecord: any = null;
        if (dto.payment.method === 'CREDITO_FIADO') {
          const customerId = dto.payment.customerId;
          if (!customerId) {
            throw new BadRequestException('Para ventas a crédito (fiado) debe seleccionarse un cliente registrado');
          }

          const customerRows: any[] = await tx.$queryRawUnsafe(
            `SELECT id, name, credit_limit, current_debt, is_active
             FROM third_parties
             WHERE tenant_id = $1::uuid AND id = $2::uuid
             FOR UPDATE`,
            tenantId,
            customerId,
          );

          if (!customerRows || customerRows.length === 0) {
            throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
          }

          customerRecord = customerRows[0];
          if (!customerRecord.is_active) {
            throw new BadRequestException(`El cliente ${customerRecord.name} se encuentra inactivo`);
          }

          const currentDebt = Number(customerRecord.current_debt);
          const creditLimit = Number(customerRecord.credit_limit);
          const newDebt = currentDebt + grandTotal.toNumber();

          if (newDebt > creditLimit) {
            throw new ConflictException(
              `El crédito excede el cupo disponible del cliente (${customerRecord.name}). Cupo: $${creditLimit}, Deuda actual: $${currentDebt}, Nuevo total: $${newDebt}`,
            );
          }
        }

        // 3. Generar consecutivo secuencial continuo y atómico por tenant
        const invoiceSeqVal = await this.getNextSequenceValue(tx, tenantId, 'INVOICE_POS');
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const consecutive = `POS-${datePrefix}-${invoiceSeqVal.toString().padStart(6, '0')}`;

        const invoiceId = randomUUID();

        // 4. Crear Factura e Ítems
        await tx.invoice.create({
          data: {
            id: invoiceId,
            tenantId,
            branchId: dto.branchId,
            posShiftId: dto.posShiftId || null,
            consecutive,
            customerId: dto.payment.customerId || null,
            customerName: dto.payment.customerName || customerRecord?.name || 'Consumidor Final',
            customerDocument: dto.payment.customerDocument || '222222222',
            subtotal: runningSubtotal.toNumber(),
            discountTotal: runningDiscountTotal.toNumber(),
            taxTotal: runningTaxTotal.toNumber(),
            total: grandTotal.toNumber(),
            paymentMethod: dto.payment.method,
            cashTendered: cashTenderedNum,
            changeGiven: changeGivenNum,
            status: 'ISSUED',
            createdBy: userId,
            items: {
              create: balancesToUpdate.map((item) => ({
                id: randomUUID(),
                tenantId,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                productSku: item.productSku,
                quantity: item.requestedQty,
                unitOfMeasure: 'UNIDAD',
                unitPrice: item.price.toNumber(),
                unitCost: item.averageCost,
                discountRate: item.discountRatePercent,
                discountAmount: item.itemDiscount.toNumber(),
                taxRate: item.taxRatePercent,
                taxAmount: item.itemTax.toNumber(),
                subtotal: item.itemNet.toNumber(),
                total: item.itemTotal.toNumber(),
              })),
            },
          },
        });

        // 5. Descontar balances, registrar movimientos y Kardex (CPP)
        const movementId = randomUUID();
        const primaryWarehouseId = dto.items[0].warehouseId;

        await tx.inventoryMovement.create({
          data: {
            id: movementId,
            tenantId,
            type: 'SALE_DISPATCH',
            status: 'POSTED',
            source: 'POS',
            warehouseId: primaryWarehouseId,
            referenceType: 'POS_SALE',
            referenceId: invoiceId,
            referenceDocument: consecutive,
            reason: `Venta POS Factura ${consecutive}`,
            createdById: userId,
            postedById: userId,
            postedAt: new Date(),
          },
        });

        for (let idx = 0; idx < balancesToUpdate.length; idx++) {
          const item = balancesToUpdate[idx];

          // Actualizar balance
          await tx.$executeRawUnsafe(
            `UPDATE inventory_balances
             SET quantity_on_hand = $1,
                 inventory_value = $2,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $3::uuid`,
            item.newQty,
            item.newInventoryValue,
            item.balanceId,
          );

          // Línea de movimiento
          await tx.inventoryMovementLine.create({
            data: {
              id: randomUUID(),
              tenantId,
              movementId,
              lineNumber: idx + 1,
              productId: item.productId,
              variantId: item.variantId,
              unitOfMeasureId: item.unitOfMeasureId,
              quantity: item.requestedQty,
              unitCost: item.averageCost,
              totalCost: item.itemCost.toNumber(),
              previousQuantity: item.currentQty,
              newQuantity: item.newQty,
              averageCostBefore: item.averageCost,
              averageCostAfter: item.newAverageCost,
              inventoryValueBefore: item.currentQty * item.averageCost,
              inventoryValueAfter: item.newInventoryValue,
            },
          });

          // Entrada de Kardex
          await tx.inventoryLedgerEntry.create({
            data: {
              id: randomUUID(),
              tenantId,
              movementId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: primaryWarehouseId,
              movementType: 'SALE_DISPATCH',
              referenceType: 'POS_SALE',
              referenceId: invoiceId,
              quantityIn: 0,
              unitCostIn: 0,
              totalCostIn: 0,
              quantityOut: item.requestedQty,
              unitCostOut: item.averageCost,
              totalCostOut: item.itemCost.toNumber(),
              balanceQuantityAfter: item.newQty,
              averageCostAfter: item.newAverageCost,
              inventoryValueAfter: item.newInventoryValue,
            },
          });
        }

        // 6. Actualizar acumuladores de turno POS si aplica
        if (dto.posShiftId) {
          const isCash = dto.payment.method === 'EFECTIVO';
          const isDigital = ['NEQUI', 'DAVIPLATA', 'TARJETA'].includes(dto.payment.method);
          const isCredit = dto.payment.method === 'CREDITO_FIADO';

          await tx.posShift.update({
            where: { id: dto.posShiftId },
            data: {
              totalSales: { increment: grandTotal.toNumber() },
              totalCashSales: isCash ? { increment: grandTotal.toNumber() } : undefined,
              totalDigitalSales: isDigital ? { increment: grandTotal.toNumber() } : undefined,
              totalCreditSales: isCredit ? { increment: grandTotal.toNumber() } : undefined,
            },
          });
        }

        // 7. Si es crédito (fiado), actualizar saldo y registrar transacción
        let creditTxId: string | null = null;
        if (dto.payment.method === 'CREDITO_FIADO' && customerRecord) {
          const prevDebt = Number(customerRecord.current_debt);
          const newDebt = prevDebt + grandTotal.toNumber();

          await tx.thirdParty.update({
            where: { id: customerRecord.id },
            data: { currentDebt: newDebt },
          });

          creditTxId = randomUUID();
          await tx.creditTransaction.create({
            data: {
              id: creditTxId,
              tenantId,
              thirdPartyId: customerRecord.id,
              type: 'CHARGE_CREDIT_SALE',
              amount: grandTotal.toNumber(),
              previousBalance: prevDebt,
              newBalance: newDebt,
              referenceNumber: consecutive,
              createdById: userId,
            },
          });
        }

        // 8. Asiento Contable por Partida Doble
        const accountCashId = await this.getOrCreateAccount(tx, tenantId, '110505', 'Caja General', 'ACTIVO', 'D');
        const accountBankId = await this.getOrCreateAccount(tx, tenantId, '111005', 'Bancos y Cuentas Digitales', 'ACTIVO', 'D');
        const accountReceivableId = await this.getOrCreateAccount(tx, tenantId, '130505', 'Clientes Nacionales', 'ACTIVO', 'D');
        const accountRevenueId = await this.getOrCreateAccount(tx, tenantId, '4135', 'Comercio al por mayor y menor', 'INGRESO', 'C');
        const accountVatId = await this.getOrCreateAccount(tx, tenantId, '2408', 'IVA Generado en Ventas', 'PASIVO', 'C');
        const accountCostId = await this.getOrCreateAccount(tx, tenantId, '6135', 'Costo de Ventas', 'COSTO', 'D');
        const accountInventoryId = await this.getOrCreateAccount(tx, tenantId, '1435', 'Mercancías no Fabricadas', 'ACTIVO', 'C');

        // Determinar cuenta de cobro
        let paymentAccountId = accountCashId;
        if (['NEQUI', 'DAVIPLATA', 'TARJETA'].includes(dto.payment.method)) {
          paymentAccountId = accountBankId;
        } else if (dto.payment.method === 'CREDITO_FIADO') {
          paymentAccountId = accountReceivableId;
        }

        const journalEntryId = randomUUID();
        // Generador atómico correlativo para asiento contable mediante tenant_sequences
        const entrySeq = await this.getNextSequenceValue(tx, tenantId, 'JOURNAL_ENTRY');

        const journalLines: Array<{
          id: string;
          tenantId: string;
          journalEntryId: string;
          accountId: string;
          thirdPartyId?: string | null;
          debit: number;
          credit: number;
          nature: 'D' | 'C';
          description: string;
        }> = [];

        // 8.1. Débito a Cobro (Caja / Banco / Clientes) por el gran total
        journalLines.push({
          id: randomUUID(),
          tenantId,
          journalEntryId,
          accountId: paymentAccountId,
          thirdPartyId: dto.payment.customerId || null,
          debit: grandTotal.toNumber(),
          credit: 0,
          nature: 'D',
          description: `Cobro Venta ${consecutive}`,
        });

        // 8.2. Crédito a Ingresos por subtotal
        journalLines.push({
          id: randomUUID(),
          tenantId,
          journalEntryId,
          accountId: accountRevenueId,
          debit: 0,
          credit: runningSubtotal.toNumber(),
          nature: 'C',
          description: `Ingreso por Ventas Factura ${consecutive}`,
        });

        // 8.3. Crédito a IVA Generado (si aplica)
        if (runningTaxTotal.toNumber() > 0) {
          journalLines.push({
            id: randomUUID(),
            tenantId,
            journalEntryId,
            accountId: accountVatId,
            debit: 0,
            credit: runningTaxTotal.toNumber(),
            nature: 'C',
            description: `IVA Generado Factura ${consecutive}`,
          });
        }

        // 8.4. Débito a Costo de Ventas y Crédito a Inventarios (si costo > 0)
        if (totalCost.toNumber() > 0) {
          journalLines.push({
            id: randomUUID(),
            tenantId,
            journalEntryId,
            accountId: accountCostId,
            debit: totalCost.toNumber(),
            credit: 0,
            nature: 'D',
            description: `Costo de Mercancía Vendida Factura ${consecutive}`,
          });

          journalLines.push({
            id: randomUUID(),
            tenantId,
            journalEntryId,
            accountId: accountInventoryId,
            debit: 0,
            credit: totalCost.toNumber(),
            nature: 'C',
            description: `Salida de Inventario Factura ${consecutive}`,
          });
        }

        // Verificación estricta de partida doble
        const totalDebitSum = journalLines.reduce((acc, l) => acc + l.debit, 0);
        const totalCreditSum = journalLines.reduce((acc, l) => acc + l.credit, 0);
        const imbalance = Math.abs(totalDebitSum - totalCreditSum);

        if (imbalance > 0.01) {
          throw new ConflictException(
            `Invariante contable violado: Débitos ($${totalDebitSum}) != Créditos ($${totalCreditSum}). Diferencia: $${imbalance}`,
          );
        }

        await tx.journalEntry.create({
          data: {
            id: journalEntryId,
            tenantId,
            branchId: dto.branchId,
            entryNumber: entrySeq,
            concept: `Venta POS Factura ${consecutive}`,
            sourceDocumentType: 'SALE_POS',
            sourceDocumentId: invoiceId,
            totalDebit: totalDebitSum,
            totalCredit: totalCreditSum,
            createdById: userId,
            lines: {
              create: journalLines.map((l) => ({
                id: l.id,
                tenantId: l.tenantId,
                accountId: l.accountId,
                thirdPartyId: l.thirdPartyId,
                debit: l.debit,
                credit: l.credit,
                nature: l.nature,
                description: l.description,
              })),
            },
          },
        });

        // Vincular journal_entry_id a la factura
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { journalEntryId },
        });

        if (creditTxId) {
          await tx.creditTransaction.update({
            where: { id: creditTxId },
            data: { journalEntryId },
          });
        }

        // 9. Transactional Outbox Event
        outboxEventId = randomUUID();
        await tx.inventoryOutboxEvent.create({
          data: {
            id: outboxEventId,
            tenantId,
            eventType: 'INVOICE_ISSUED',
            aggregateType: 'INVOICE',
            aggregateId: invoiceId,
            status: 'PENDING',
            payload: {
              invoiceId,
              consecutive,
              subtotal: runningSubtotal.toNumber(),
              taxTotal: runningTaxTotal.toNumber(),
              total: grandTotal.toNumber(),
              paymentMethod: dto.payment.method,
              itemCount: dto.items.length,
            },
          },
        });

        // 10. Registro de auditoría
        await tx.inventoryAuditLog.create({
          data: {
            id: randomUUID(),
            tenantId,
            action: 'CREATE',
            entityType: 'INVOICE',
            entityId: invoiceId,
            performedById: userId !== 'system' ? userId : null,
            newValues: {
              actionType: 'CHECKOUT_POS',
              consecutive,
              total: grandTotal.toNumber(),
              paymentMethod: dto.payment.method,
              itemCount: dto.items.length,
            },
          },
        });

        // 11. Armar DTO de respuesta
        const responseData: CheckoutResponseDto = {
          success: true,
          invoiceId,
          consecutive,
          subtotal: runningSubtotal.toNumber(),
          discountTotal: runningDiscountTotal.toNumber(),
          taxTotal: runningTaxTotal.toNumber(),
          total: grandTotal.toNumber(),
          paymentMethod: dto.payment.method,
          cashTendered: cashTenderedNum,
          changeGiven: changeGivenNum,
          journalEntryId,
          outboxEventId,
          createdAt: new Date().toISOString(),
        };

        // 12. Actualizar estado de Idempotencia a COMPLETED dentro de la transacción
        await this.idempotencyService.markCompleted(
          tenantId,
          idempotencyKey,
          recoveryCount,
          201,
          responseData,
          invoiceId,
          'INVOICE',
        );

        return responseData;
      });
    } catch (err: any) {
      // Reversión automática de PostgreSQL en caso de fallo.
      // Marcar idempotencia como FAILED de forma independiente.
      await this.idempotencyService.markFailed(
        tenantId,
        idempotencyKey,
        recoveryCount,
        err.message || 'Error durante la ejecución del checkout',
      );

      if (redisLock) {
        await redisLock.release();
      }

      this.logger.error(`Checkout fallido para clave "${idempotencyKey}": ${err.message}`);
      throw err;
    }

    // ========================================================================
    // FASE 3: EFECTOS POST-COMMIT (Fuera de la transacción PostgreSQL)
    // ========================================================================
    // 1. Liberar lock auxiliar de Redis
    if (redisLock) {
      try {
        await redisLock.release();
      } catch (err: any) {
        this.logger.warn(`Error liberando lock Redis: ${err.message}`);
      }
    }

    // 2. Generación opcional de ticket térmico ESC/POS
    if (dto.printTicket !== false) {
      try {
        const ticketResult = EscPosBuilder.build({
          profile: dto.ticketWidth === 58 ? '58mm' : '80mm',
          openDrawer: dto.payment.method === 'EFECTIVO',
          cutPaper: true,
          lines: [
            '[C][B]UNISAAS POS',
            `[C]FACTURA: ${checkoutResult.consecutive}`,
            '---',
            ...dto.items.map((i) => `${i.quantity}x $${i.unitPrice}`),
            '---',
            `[R]SUBTOTAL: $${checkoutResult.subtotal.toFixed(2)}`,
            `[R]IVA: $${checkoutResult.taxTotal.toFixed(2)}`,
            `[R][B]TOTAL: $${checkoutResult.total.toFixed(2)}`,
            `[R]MEDIO: ${checkoutResult.paymentMethod}`,
            '===',
            '[C]¡Gracias por su compra!',
          ],
        });

        checkoutResult.ticketBase64 = ticketResult.data;
      } catch (err: any) {
        this.logger.warn(`No se pudo generar el ticket ESC/POS: ${err.message}`);
      }
    }

    // 3. Procesar evento de outbox post-commit
    if (outboxEventId!) {
      try {
        await this.outboxProcessorService.processEvent(tenantId, outboxEventId);
      } catch (err: any) {
        this.logger.warn(`Despacho inmediato de outbox fallido (${err.message}). El worker periódico lo reintentará.`);
      }
    }

    return checkoutResult;
  }
}
