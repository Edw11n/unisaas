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

const cfg = getFixturesConfig(3);
const {
  tenantId: TEST_TENANT_ID,
  branchId: TEST_BRANCH_ID,
  warehouseId: TEST_WAREHOUSE_ID,
  userId: TEST_USER_ID,
  productId: TEST_PRODUCT_ID,
  variantId: TEST_VARIANT_ID,
} = cfg;

describe('Fase 6: Efectos Post-Commit y Transactional Outbox (@unisaas/api-gateway)', () => {
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

  it('1. Genera ticket térmico ESC/POS válido solo tras confirmación de la venta', async () => {
    const key = 'post-commit-ticket-01';
    const res = await coordinator.executeCheckout(
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
            taxRate: 19,
          },
        ],
        payment: {
          method: 'EFECTIVO',
          cashTendered: 5000,
        },
        printTicket: true,
        ticketWidth: 80,
      },
    );

    assert.ok(res.ticketBase64, 'Debe retornar el ticket en base64');
    const rawBuffer = Buffer.from(res.ticketBase64, 'base64');

    // Verificar comandos ESC/POS obligatorios
    // 0x1B 0x40 = ESC @ (Init)
    assert.equal(rawBuffer[0], 0x1b);
    assert.equal(rawBuffer[1], 0x40);

    // 0x1B 0x74 0x02 = ESC t 2 (CP850)
    assert.equal(rawBuffer[2], 0x1b);
    assert.equal(rawBuffer[3], 0x74);
    assert.equal(rawBuffer[4], 0x02);

    // Contenido legible
    const textContent = rawBuffer.toString('utf-8');
    assert.ok(textContent.includes('UNISAAS POS'), 'Debe contener el encabezado del establecimiento');
    assert.ok(textContent.includes(res.consecutive), 'Debe contener el consecutivo de la factura');
  });

  it('2. El despachador post-commit marca el evento Transactional Outbox como PROCESSED', async () => {
    const key = 'post-commit-outbox-01';
    const res = await coordinator.executeCheckout(
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

    // Consultar el evento del outbox
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const outboxEvt = await tx.inventoryOutboxEvent.findUnique({
        where: { id: res.outboxEventId },
      });

      assert.ok(outboxEvt, 'El evento del outbox debe existir');
      assert.equal(outboxEvt.eventType, 'INVOICE_ISSUED');
      assert.equal(outboxEvt.status, 'PROCESSED', 'El efecto post-commit debió marcarlo como PROCESSED');
      assert.ok(outboxEvt.processedAt, 'Debe tener marca de tiempo processedAt');
    });
  });

  it('3. Worker de recuperación de Outbox: procesa eventos pendientes acumulados', async () => {
    // Insertar dos eventos PENDING manualmente
    const evt1Id = 'e1111111-0000-0000-0000-000000000001';
    const evt2Id = 'e2222222-0000-0000-0000-000000000002';
    const dummyAggregateId = 'a0000000-0000-0000-0000-000000000001';

    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      await tx.inventoryOutboxEvent.createMany({
        data: [
          {
            id: evt1Id,
            tenantId: TEST_TENANT_ID,
            eventType: 'STOCK_SYNC',
            aggregateType: 'INVENTORY',
            aggregateId: dummyAggregateId,
            status: 'PENDING',
            payload: { sync: true },
          },
          {
            id: evt2Id,
            tenantId: TEST_TENANT_ID,
            eventType: 'DIAN_TRANSMIT',
            aggregateType: 'INVOICE',
            aggregateId: dummyAggregateId,
            status: 'PENDING',
            payload: { transmit: true },
          },
        ],
      });
    });

    const processResult = await outboxProcessorService.processPendingEvents(TEST_TENANT_ID);
    assert.ok(processResult.processed >= 2, 'Debió procesar al menos los 2 eventos pendientes');
    assert.equal(processResult.failed, 0);

    // Verificar en DB que ambos quedaron PROCESSED
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const e1 = await tx.inventoryOutboxEvent.findUnique({ where: { id: evt1Id } });
      const e2 = await tx.inventoryOutboxEvent.findUnique({ where: { id: evt2Id } });

      assert.equal(e1?.status, 'PROCESSED');
      assert.equal(e2?.status, 'PROCESSED');
    });
  });
});
