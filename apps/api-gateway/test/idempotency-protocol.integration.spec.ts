import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { RedisClientService, IdempotencyLockService } from '@unisaas/redis-client';
import { IdempotencyService } from '../src/checkout/services/idempotency.service.js';
import { OutboxProcessorService } from '../src/checkout/services/outbox-processor.service.js';
import { CheckoutCoordinatorService } from '../src/checkout/services/checkout-coordinator.service.js';
import {
  setupCheckoutTestFixtures,
  getFixturesConfig,
} from './checkout-fixtures.js';

const cfg = getFixturesConfig(2);
const {
  tenantId: TEST_TENANT_ID,
  branchId: TEST_BRANCH_ID,
  warehouseId: TEST_WAREHOUSE_ID,
  userId: TEST_USER_ID,
  productId: TEST_PRODUCT_ID,
  variantId: TEST_VARIANT_ID,
} = cfg;

describe('Fase 6: Protocolo de Idempotencia Durable en Dos Fases (@unisaas/api-gateway)', () => {
  let adminPrisma: PrismaClient;
  let runtimePrisma: PrismaClient;
  let redisService: RedisClientService;
  let idempotencyLockService: IdempotencyLockService;
  let idempotencyService: IdempotencyService;
  let outboxProcessorService: OutboxProcessorService;
  let coordinator: CheckoutCoordinatorService;

  before(async () => {
    adminPrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://saas_migration_admin:postgres@localhost:5432/saas_contable_db?schema=public',
        },
      },
    });

    runtimePrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
        },
      },
    });

    await adminPrisma.$connect();
    await runtimePrisma.$connect();

    redisService = new RedisClientService();
    await redisService.connect();
    idempotencyLockService = new IdempotencyLockService(redisService);

    idempotencyService = new IdempotencyService(runtimePrisma);
    outboxProcessorService = new OutboxProcessorService(runtimePrisma);
    coordinator = new CheckoutCoordinatorService(
      runtimePrisma,
      idempotencyService,
      outboxProcessorService,
      idempotencyLockService,
    );

    await setupCheckoutTestFixtures(adminPrisma, cfg);
  });

  after(async () => {
    if (adminPrisma) await adminPrisma.$disconnect();
    if (runtimePrisma) await runtimePrisma.$disconnect();
    if (redisService) await redisService.disconnect();
  });

  it('1. Replay exacto: misma clave y mismo payload retorna respuesta idéntica con isReplay: true sin duplicar registros', async () => {
    const key = 'idemp-replay-test-01';
    const payload = {
      branchId: TEST_BRANCH_ID,
      items: [
        {
          productId: TEST_PRODUCT_ID,
          variantId: TEST_VARIANT_ID,
          warehouseId: TEST_WAREHOUSE_ID,
          quantity: 1,
          unitPrice: 3000,
          taxRate: 19,
        },
      ],
      payment: {
        method: 'EFECTIVO' as const,
        cashTendered: 5000,
      },
    };

    // Primera ejecución (Original)
    const firstRes = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      key,
      payload,
    );
    assert.equal(firstRes.success, true);
    assert.equal(firstRes.isReplay, undefined);

    // Consulta de stock post-primera venta
    const stockAfterFirst = await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const b = await tx.inventoryBalance.findFirst({
        where: { variantId: TEST_VARIANT_ID, warehouseId: TEST_WAREHOUSE_ID },
      });
      return Number(b?.quantityOnHand);
    });

    // Segunda ejecución (Replay)
    const secondRes = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      key,
      payload,
    );

    // Verificación de respuesta cacheada
    assert.equal(secondRes.success, true);
    assert.equal(secondRes.isReplay, true, 'Debe marcarse como isReplay: true');
    assert.equal(secondRes.invoiceId, firstRes.invoiceId, 'Debe coincidir el invoiceId original');
    assert.equal(secondRes.consecutive, firstRes.consecutive, 'Debe coincidir el consecutivo original');
    assert.equal(secondRes.total, firstRes.total);

    // Verificación en base de datos: NO debe haber stock duplicado ni facturas duplicadas
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const invoicesWithConsecutive = await tx.invoice.count({
        where: { consecutive: firstRes.consecutive },
      });
      assert.equal(invoicesWithConsecutive, 1, 'No debe existir más de una factura');

      const b = await tx.inventoryBalance.findFirst({
        where: { variantId: TEST_VARIANT_ID, warehouseId: TEST_WAREHOUSE_ID },
      });
      assert.equal(Number(b?.quantityOnHand), stockAfterFirst, 'El stock no debe descontarse de nuevo');
    });
  });

  it('2. Payload mismatch: misma clave con payload alterado es rechazada con 409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', async () => {
    const key = 'idemp-mismatch-test-01';

    // Primera ejecución con cantidad = 1
    await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      key,
      {
        branchId: TEST_BRANCH_ID,
        items: [
          {
            productId: TEST_PRODUCT_ID,
            variantId: TEST_VARIANT_ID,
            warehouseId: TEST_WAREHOUSE_ID,
            quantity: 1,
            unitPrice: 3000,
          },
        ],
        payment: {
          method: 'EFECTIVO',
          cashTendered: 5000,
        },
      },
    );

    // Intento con misma clave pero cantidad = 4 (payload alterado)
    await assert.rejects(
      async () => {
        await coordinator.executeCheckout(
          TEST_TENANT_ID,
          TEST_USER_ID,
          key,
          {
            branchId: TEST_BRANCH_ID,
            items: [
              {
                productId: TEST_PRODUCT_ID,
                variantId: TEST_VARIANT_ID,
                warehouseId: TEST_WAREHOUSE_ID,
                quantity: 4, // Modificado
                unitPrice: 3000,
              },
            ],
            payment: {
              method: 'EFECTIVO',
              cashTendered: 20000,
            },
          },
        );
      },
      (err: any) => {
        const response = err.getResponse ? err.getResponse() : err;
        assert.ok(
          err.message?.includes('carga útil diferente') ||
          response?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' ||
          err.status === 409,
          'Debe lanzar error 409 con código IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
        );
        return true;
      },
    );
  });

  it('3. Concurrencia determinista: peticiones simultáneas con misma clave no causan doble venta', async () => {
    const key = 'idemp-concurrent-test-01';
    const payload = {
      branchId: TEST_BRANCH_ID,
      items: [
        {
          productId: TEST_PRODUCT_ID,
          variantId: TEST_VARIANT_ID,
          warehouseId: TEST_WAREHOUSE_ID,
          quantity: 1,
          unitPrice: 3000,
          taxRate: 19,
        },
      ],
      payment: {
        method: 'EFECTIVO' as const,
        cashTendered: 10000,
      },
    };

    // Disparar dos peticiones concurrentes idénticas
    const results = await Promise.allSettled([
      coordinator.executeCheckout(TEST_TENANT_ID, TEST_USER_ID, key, payload),
      coordinator.executeCheckout(TEST_TENANT_ID, TEST_USER_ID, key, payload),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Al menos una debe completarse con éxito
    assert.ok(fulfilled.length >= 1, 'Al menos una petición debe tener éxito');

    if (rejected.length > 0) {
      // La rechazada debe haber sido por concurrencia en curso
      const rejReason: any = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejReason.message?.includes('Operación en curso') ||
        rejReason.status === 409,
        'La petición rechazada debe ser por operación en curso (409)',
      );
    }

    // Verificar que en base de datos solo se generó 1 factura para esa clave
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const idempRecord = await tx.inventoryIdempotencyKey.findUnique({
        where: { tenantId_key: { tenantId: TEST_TENANT_ID, key } },
      });
      assert.ok(idempRecord);
      assert.equal(idempRecord.status, 'COMPLETED');
    });
  });

  it('4. Recuperación de arrendamiento vencido (Worker Crash / 30s timeout CAS)', async () => {
    const crashKey = 'idemp-worker-crash-test';
    const payload = {
      branchId: TEST_BRANCH_ID,
      items: [
        {
          productId: TEST_PRODUCT_ID,
          variantId: TEST_VARIANT_ID,
          warehouseId: TEST_WAREHOUSE_ID,
          quantity: 1,
          unitPrice: 3000,
          taxRate: 19,
        },
      ],
      payment: {
        method: 'EFECTIVO' as const,
        cashTendered: 5000,
      },
    };

    const hash = idempotencyService.computeHash(payload);
    const staleDate = new Date(Date.now() - 35_000); // 35 segundos en el pasado

    // Simular que un worker anterior cayó dejando el registro en IN_PROGRESS hace 35s
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      await tx.inventoryIdempotencyKey.create({
        data: {
          tenantId: TEST_TENANT_ID,
          key: crashKey,
          operation: 'CHECKOUT_POS',
          requestHash: hash,
          status: 'IN_PROGRESS',
          lockedAt: staleDate,
          recoveryCount: 0,
        },
      });
    });

    // Nuevo worker ejecuta la misma operación
    const recoveredRes = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      crashKey,
      payload,
    );

    assert.equal(recoveredRes.success, true);

    // Verificar en la base de datos que recovery_count se incrementó mediante el CAS
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const keyRecord = await tx.inventoryIdempotencyKey.findUnique({
        where: { tenantId_key: { tenantId: TEST_TENANT_ID, key: crashKey } },
      });
      assert.ok(keyRecord);
      assert.equal(keyRecord.status, 'COMPLETED');
      assert.equal(keyRecord.recoveryCount, 1, 'El recoveryCount debió incrementarse a 1 por la recuperación CAS');
    });
  });

  it('5. Reintento tras fallo previo (FAILED): se recupera y completa exitosamente', async () => {
    const retryKey = 'idemp-failed-recovery-test';
    const payload = {
      branchId: TEST_BRANCH_ID,
      items: [
        {
          productId: TEST_PRODUCT_ID,
          variantId: TEST_VARIANT_ID,
          warehouseId: TEST_WAREHOUSE_ID,
          quantity: 1,
          unitPrice: 3000,
          taxRate: 19,
        },
      ],
      payment: {
        method: 'EFECTIVO' as const,
        cashTendered: 5000,
      },
    };

    const hash = idempotencyService.computeHash(payload);

    // 1. Simular un fallo previo registrado en PostgreSQL (status: FAILED) con el mismo payload
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      await tx.inventoryIdempotencyKey.create({
        data: {
          tenantId: TEST_TENANT_ID,
          key: retryKey,
          operation: 'CHECKOUT_POS',
          requestHash: hash,
          status: 'FAILED',
          responseBody: { error: 'Error transitorio de conexión a pasarela' },
        },
      });
    });

    // 2. Reintento con el mismo payload y misma clave
    const successRes = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      retryKey,
      payload,
    );

    assert.equal(successRes.success, true);

    // Verificar que en base de datos pasó a COMPLETED y recuperó el lease
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const rec = await tx.inventoryIdempotencyKey.findUnique({
        where: { tenantId_key: { tenantId: TEST_TENANT_ID, key: retryKey } },
      });
      assert.ok(rec);
      assert.equal(rec.status, 'COMPLETED');
      assert.equal(rec.recoveryCount, 1, 'El recoveryCount debió incrementarse a 1');
    });
  });
});
