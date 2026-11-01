import { Prisma, PrismaClient } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantContextException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextException';
  }
}

/**
 * Ejecuta una operación transaccional dentro del contexto estricto de un inquilino (Tenant RLS).
 *
 * Garantías Innegociables:
 * 1. SET LOCAL app.current_tenant_id: Inyecta el tenant_id exclusivamente para la transacción interactiva actual.
 * 2. SET LOCAL ROLE app_runtime: Conmuta al rol de ejecución con privilegios mínimos (NOBYPASSRLS).
 * 3. Uso Exclusivo de tx: La función receptora recibe únicamente el cliente transaccional 'tx'.
 * 4. Reversión Automática: Al finalizar la transacción (COMMIT o ROLLBACK), PostgreSQL revierte
 *    automáticamente el rol y la variable de sesión, devolviendo la conexión física limpia al pool.
 */
export async function withTenantContext<T>(
  client: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new TenantContextException('El identificador de inquilino (tenantId) es obligatorio');
  }

  const normalizedTenantId = tenantId.trim().toLowerCase();
  if (!UUID_REGEX.test(normalizedTenantId)) {
    throw new TenantContextException(
      `Formato de tenantId inválido (debe ser UUID): "${tenantId}"`,
    );
  }

  return client.$transaction(
    async (tx) => {
      // 1. Conmutar al rol de ejecución de mínimos privilegios sin BYPASSRLS
      await tx.$executeRawUnsafe('SET LOCAL ROLE app_runtime');

      // 2. Establecer el contexto del tenant para las políticas RLS
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${normalizedTenantId}'`);

      // 3. Ejecutar la lógica de negocio exclusivamente sobre el cliente transaccional tx
      return fn(tx);
    },
    {
      maxWait: options?.maxWait ?? 15000,
      timeout: options?.timeout ?? 20000,
      isolationLevel: options?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}

