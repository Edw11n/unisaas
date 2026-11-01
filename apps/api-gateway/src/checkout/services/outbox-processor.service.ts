import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';

export interface OutboxProcessResult {
  processed: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Procesa un evento del Outbox de forma inmediata tras el COMMIT de la transacción de negocio.
   */
  async processEvent(tenantId: string, eventId: string): Promise<boolean> {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const event = await tx.inventoryOutboxEvent.findUnique({
        where: { id: eventId },
      });

      if (!event || event.status === 'PROCESSED') {
        return false;
      }

      try {
        // En un entorno de producción, aquí se despacha el evento hacia el bus de mensajes,
        // webhook externo o servicio de notificaciones / DIAN.
        this.logger.log(
          `[Outbox] Despachando evento "${event.eventType}" (${event.id}) para agregado ${event.aggregateType}:${event.aggregateId}`,
        );

        // Actualizar a PROCESSED
        await tx.inventoryOutboxEvent.update({
          where: { id: eventId },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });

        return true;
      } catch (err: any) {
        this.logger.error(`Error procesando outbox event ${eventId}: ${err.message}`);
        await tx.inventoryOutboxEvent.update({
          where: { id: eventId },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: err.message,
          },
        });
        return false;
      }
    });
  }

  /**
   * Procesa un lote de eventos pendientes para garantizar at-least-once delivery
   * en caso de que el despachador post-commit haya sufrido una desconexión transitoria.
   */
  async processPendingEvents(tenantId: string, batchSize: number = 20): Promise<OutboxProcessResult> {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const pendingEvents = await tx.inventoryOutboxEvent.findMany({
        where: {
          tenantId,
          status: 'PENDING',
          availableAt: { lte: new Date() },
        },
        orderBy: { availableAt: 'asc' },
        take: batchSize,
      });

      const result: OutboxProcessResult = {
        processed: 0,
        failed: 0,
        errors: [],
      };

      for (const evt of pendingEvents) {
        try {
          await tx.inventoryOutboxEvent.update({
            where: { id: evt.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });
          result.processed++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({ eventId: evt.id, error: err.message });
          await tx.inventoryOutboxEvent.update({
            where: { id: evt.id },
            data: {
              status: 'FAILED',
              attempts: { increment: 1 },
              lastError: err.message,
            },
          });
        }
      }

      return result;
    });
  }
}

