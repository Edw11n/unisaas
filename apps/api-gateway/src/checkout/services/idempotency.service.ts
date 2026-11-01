import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient, withTenantContext } from '@unisaas/database';

export interface IdempotencyLeaseAcquired {
  status: 'ACQUIRED';
  recoveryCount: number;
}

export interface IdempotencyLeaseReplay {
  status: 'REPLAY';
  statusCode: number;
  responseBody: any;
}

export type IdempotencyLease = IdempotencyLeaseAcquired | IdempotencyLeaseReplay;

/**
 * Normaliza recursivamente las claves de un objeto para garantizar
 * que dos cargas útiles semánticamente idénticas produzcan el mismo hash SHA-256.
 */
function canonicalize(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sortedKeys = Object.keys(val).sort();
  const result: Record<string, any> = {};
  for (const k of sortedKeys) {
    result[k] = canonicalize(val[k]);
  }
  return result;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly LEASE_TIMEOUT_MS = 30_000; // 30 segundos de arrendamiento

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Genera el fingerprint SHA-256 canónico de la carga útil.
   */
  computeHash(payload: unknown): string {
    const canonical = canonicalize(payload);
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Fase 1: Reserva de arrendamiento (lease) con control de concurrencia y protocolo de recuperación.
   *
   * Garantías:
   * 1. Inserta `IN_PROGRESS` con `recovery_count = 0`.
   * 2. Si colisiona:
   *    - Si el hash es diferente => lanza 409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH.
   *    - Si ya está `COMPLETED` => retorna replay con respuesta almacenada.
   *    - Si está `IN_PROGRESS` y tiene < 30s => lanza 409 IDEMPOTENCY_IN_PROGRESS.
   *    - Si está `IN_PROGRESS` y tiene >= 30s => recupera lease con CAS incrementando `recovery_count`.
   *    - Si está `FAILED` => permite reintento recuperando lease con CAS a `IN_PROGRESS`.
   */
  async reserveLease(
    tenantId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): Promise<IdempotencyLease> {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const leaseId = randomUUID();

      // 1. Intentar inserción inicial de nuevo lease atómicamente con ON CONFLICT DO NOTHING
      // Esto evita abortar la transacción en PostgreSQL en caso de concurrencia o replay
      const insertedRows = await tx.$executeRawUnsafe(
        `INSERT INTO inventory_idempotency_keys (
           id, tenant_id, key, operation, request_hash, status, locked_at, recovery_count, created_at, updated_at, expires_at
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, 'IN_PROGRESS', NOW(), 0, NOW(), NOW(), NOW() + INTERVAL '24 hours'
         )
         ON CONFLICT (tenant_id, key) DO NOTHING`,
        leaseId,
        tenantId,
        key,
        operation,
        requestHash,
      );

      if (insertedRows > 0) {
        return { status: 'ACQUIRED', recoveryCount: 0 };
      }

      // 2. Si la clave ya existía, consultar su estado actual
      const existing = await tx.inventoryIdempotencyKey.findUnique({
        where: {
          tenantId_key: {
            tenantId,
            key,
          },
        },
      });

      if (!existing) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Error de concurrencia al resolver la clave de idempotencia.',
        });
      }

      // 3. Validar coincidencia de payload fingerprint
      if (existing.requestHash !== requestHash) {
        this.logger.warn(
          `Payload mismatch for idempotency key "${key}": existing=${existing.requestHash}, new=${requestHash}`,
        );
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
          message: 'La clave de idempotencia ya fue utilizada con una carga útil diferente.',
        });
      }

      // 4. Si ya fue completada exitosamente, devolver replay inmediato
      if (existing.status === 'COMPLETED') {
        return {
          status: 'REPLAY',
          statusCode: existing.statusCode ?? 200,
          responseBody: existing.responseBody,
        };
      }

      // 5. Si está IN_PROGRESS, verificar expiración de arrendamiento
      if (existing.status === 'IN_PROGRESS') {
        const elapsedMs = Date.now() - new Date(existing.lockedAt).getTime();

        if (elapsedMs < this.LEASE_TIMEOUT_MS) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_IN_PROGRESS',
            message: 'Operación en curso para esta clave de idempotencia. Intente de nuevo en breve.',
            retryAfterSeconds: 2,
          });
        }

        // Arrendamiento vencido (> 30s): recuperación por caída de worker mediante CAS
        this.logger.log(
          `Recuperando lease expirado (${elapsedMs}ms) para clave "${key}" (recoveryCount: ${existing.recoveryCount})`,
        );

        const rowsUpdated = await tx.$executeRawUnsafe(
          `UPDATE inventory_idempotency_keys
           SET locked_at = NOW(),
               recovery_count = recovery_count + 1,
               updated_at = NOW()
           WHERE tenant_id = $1::uuid
             AND key = $2
             AND status = 'IN_PROGRESS'
             AND locked_at = $3::timestamptz`,
          tenantId,
          key,
          existing.lockedAt,
        );

        if (rowsUpdated > 0) {
          return {
            status: 'ACQUIRED',
            recoveryCount: existing.recoveryCount + 1,
          };
        }

        // Si otro worker ganó el CAS entretanto
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Operación en curso para esta clave de idempotencia.',
          retryAfterSeconds: 2,
        });
      }

      // 6. Si falló previamente (FAILED), permitir reintento recuperando con CAS
      if (existing.status === 'FAILED') {
        this.logger.log(
          `Reintentando operación fallida previa para clave "${key}" (recoveryCount: ${existing.recoveryCount})`,
        );

        const rowsUpdated = await tx.$executeRawUnsafe(
          `UPDATE inventory_idempotency_keys
           SET status = 'IN_PROGRESS',
               locked_at = NOW(),
               recovery_count = recovery_count + 1,
               updated_at = NOW()
           WHERE tenant_id = $1::uuid
             AND key = $2
             AND status = 'FAILED'`,
          tenantId,
          key,
        );

        if (rowsUpdated > 0) {
          return {
            status: 'ACQUIRED',
            recoveryCount: existing.recoveryCount + 1,
          };
        }

        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Operación en curso para esta clave de idempotencia.',
          retryAfterSeconds: 2,
        });
      }

      throw new ConflictException({
        code: 'IDEMPOTENCY_UNKNOWN_STATE',
        message: 'Estado de idempotencia desconocido.',
      });
    });
  }

  /**
   * Marca el arrendamiento como COMPLETED dentro o inmediatamente al cierre de la transacción.
   * Utiliza el fencing token (`recovery_count`) para asegurar que un worker zombi no sobreescriba
   * un lease que ya fue recuperado por otra instancia.
   */
  async markCompleted(
    tenantId: string,
    key: string,
    recoveryCount: number,
    statusCode: number,
    responseBody: any,
    resourceId?: string,
    resourceType?: string,
  ): Promise<void> {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const rowsUpdated = await tx.$executeRawUnsafe(
        `UPDATE inventory_idempotency_keys
         SET status = 'COMPLETED',
             status_code = $1,
             response_body = $2::jsonb,
             resource_id = $3::uuid,
             resource_type = $4,
             updated_at = NOW()
         WHERE tenant_id = $5::uuid
           AND key = $6
           AND recovery_count = $7
           AND status = 'IN_PROGRESS'`,
        statusCode,
        JSON.stringify(responseBody),
        resourceId ?? null,
        resourceType ?? null,
        tenantId,
        key,
        recoveryCount,
      );

      if (rowsUpdated === 0) {
        this.logger.warn(
          `Fencing violation: Lease para clave "${key}" (recoveryCount: ${recoveryCount}) ya no pertenece a este worker.`,
        );
        throw new ConflictException({
          code: 'IDEMPOTENCY_LEASE_LOST',
          message: 'El cerrojo de idempotencia expiró y fue reclamado por otro worker.',
        });
      }
    });
  }

  /**
   * Marca el arrendamiento como FAILED tras una reversión (rollback) de la transacción de negocio.
   * Permite que posteriores reintentos detecten el fallo previo y se recuperen limpiamente.
   */
  async markFailed(
    tenantId: string,
    key: string,
    recoveryCount: number,
    errorMessage: string,
  ): Promise<void> {
    try {
      await withTenantContext(this.prisma, tenantId, async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE inventory_idempotency_keys
           SET status = 'FAILED',
               response_body = $1::jsonb,
               updated_at = NOW()
           WHERE tenant_id = $2::uuid
             AND key = $3
             AND recovery_count = $4
             AND status = 'IN_PROGRESS'`,
          JSON.stringify({
            error: errorMessage,
            failedAt: new Date().toISOString(),
          }),
          tenantId,
          key,
          recoveryCount,
        );
      });
    } catch (err: any) {
      this.logger.error(`Error al marcar idempotencia como FAILED para clave "${key}": ${err.message}`);
    }
  }
}
