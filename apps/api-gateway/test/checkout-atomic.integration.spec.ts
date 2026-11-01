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

const cfg = getFixturesConfig(1);
const {
  tenantId: TEST_TENANT_ID,
  branchId: TEST_BRANCH_ID,
  warehouseId: TEST_WAREHOUSE_ID,
  userId: TEST_USER_ID,
  productId: TEST_PRODUCT_ID,
  variantId: TEST_VARIANT_ID,
  customerId: TEST_CUSTOMER_ID,
} = cfg;

describe('Fase 6: Orquestación Atómica de Checkout POS en PostgreSQL (@unisaas/api-gateway)', () => {
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

  it('1. Checkout exitoso coordina Factura, Stock FOR UPDATE, Kardex CPP, Asiento Contable y Outbox en una sola transacción', async () => {
    const idempotencyKey = 'pos-checkout-key-001';
    const response = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      idempotencyKey,
      {
        branchId: TEST_BRANCH_ID,
        items: [
          {
            productId: TEST_PRODUCT_ID,
            variantId: TEST_VARIANT_ID,
            warehouseId: TEST_WAREHOUSE_ID,
            quantity: 2,
            unitPrice: 3000,
            taxRate: 19,
          },
        ],
        payment: {
          method: 'EFECTIVO',
          cashTendered: 10000,
        },
        printTicket: true,
      },
    );

    // Verificación de respuesta
    assert.equal(response.success, true);
    assert.ok(response.consecutive.startsWith('POS-'), 'Debe generar consecutivo formal POS-YYYYMMDD-XXXXX');
    assert.equal(response.subtotal, 6000);
    assert.equal(response.taxTotal, 1140);
    assert.equal(response.total, 7140);
    assert.equal(response.cashTendered, 10000);
    assert.equal(response.changeGiven, 2860);
    assert.ok(response.ticketBase64, 'Debe incluir ticket ESC/POS generado en base64');

    // Verificación en PostgreSQL bajo RLS (app_runtime)
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      // 1.1 Factura creada
      const inv = await tx.invoice.findUnique({
        where: { id: response.invoiceId },
        include: { items: true },
      });
      assert.ok(inv, 'La factura debe existir en la base de datos');
      assert.equal(inv.status, 'ISSUED');
      assert.equal(Number(inv.total), 7140);
      assert.equal(inv.items.length, 1);
      assert.equal(Number(inv.items[0].quantity), 2);
      assert.equal(Number(inv.items[0].subtotal), 6000);
      assert.equal(Number(inv.items[0].taxAmount), 1140);

      // 1.2 Stock descontado en inventory_balances
      const balance = await tx.inventoryBalance.findFirst({
        where: { variantId: TEST_VARIANT_ID, warehouseId: TEST_WAREHOUSE_ID },
      });
      assert.ok(balance);
      assert.equal(Number(balance.quantityOnHand), 98, 'Debe haber descontado 2 unidades de las 100 iniciales');
      assert.equal(Number(balance.inventoryValue), 147000, '98 unidades * $1500 costo = $147,000');

      // 1.3 Movimiento y líneas
      const movement = await tx.inventoryMovement.findFirst({
        where: { referenceId: response.invoiceId },
        include: { lines: true },
      });
      assert.ok(movement, 'Debe registrarse el movimiento de inventario');
      assert.equal(movement.type, 'SALE_DISPATCH');
      assert.equal(movement.status, 'POSTED');
      assert.equal(movement.lines.length, 1);
      assert.equal(Number(movement.lines[0].previousQuantity), 100);
      assert.equal(Number(movement.lines[0].newQuantity), 98);

      // 1.4 Kardex (inventory_ledger_entries) con Costo Promedio Ponderado
      const kardex = await tx.inventoryLedgerEntry.findFirst({
        where: { referenceId: response.invoiceId },
      });
      assert.ok(kardex, 'Debe existir la entrada en el Kardex contable');
      assert.equal(kardex.movementType, 'SALE_DISPATCH');
      assert.equal(Number(kardex.quantityOut), 2);
      assert.equal(Number(kardex.unitCostOut), 1500);
      assert.equal(Number(kardex.totalCostOut), 3000);
      assert.equal(Number(kardex.balanceQuantityAfter), 98);

      // 1.5 Asiento Contable por Partida Doble
      const journal = await tx.journalEntry.findUnique({
        where: { id: response.journalEntryId },
        include: { lines: true },
      });
      assert.ok(journal, 'Debe existir el asiento contable');
      assert.equal(Number(journal.totalDebit), 10140, 'Total débitos = $7140 venta + $3000 costo');
      assert.equal(Number(journal.totalCredit), 10140, 'Total créditos = $7140 venta + $3000 costo');
      assert.equal(Number(journal.totalDebit), Number(journal.totalCredit), 'Invariante estricto de partida doble');

      // 1.6 Idempotencia marcada como COMPLETED
      const idemp = await tx.inventoryIdempotencyKey.findFirst({
        where: { key: idempotencyKey },
      });
      assert.ok(idemp);
      assert.equal(idemp.status, 'COMPLETED');
      assert.equal(idemp.statusCode, 201);
    });
  });

  it('2. Reversión atómica total (ROLLBACK) ante stock insuficiente sin estados parciales huérfanos', async () => {
    const initialInvoicesCount = await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      return tx.invoice.count();
    });

    const failedKey = 'pos-checkout-fail-stock';

    await assert.rejects(
      async () => {
        await coordinator.executeCheckout(
          TEST_TENANT_ID,
          TEST_USER_ID,
          failedKey,
          {
            branchId: TEST_BRANCH_ID,
            items: [
              {
                productId: TEST_PRODUCT_ID,
                variantId: TEST_VARIANT_ID,
                warehouseId: TEST_WAREHOUSE_ID,
                quantity: 99999, // Supera con creces las 98 unidades disponibles
                unitPrice: 3000,
              },
            ],
            payment: {
              method: 'EFECTIVO',
              cashTendered: 500000000,
            },
          },
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Stock insuficiente'));
        return true;
      },
    );

    // Verificar que NADA se persistió en las tablas de negocio
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const currentInvoicesCount = await tx.invoice.count();
      assert.equal(currentInvoicesCount, initialInvoicesCount, 'No debe haberse creado ninguna factura huérfana');

      const balance = await tx.inventoryBalance.findFirst({
        where: { variantId: TEST_VARIANT_ID, warehouseId: TEST_WAREHOUSE_ID },
      });
      assert.equal(Number(balance?.quantityOnHand), 98, 'El stock debe mantenerse intacto en 98');

      // La clave de idempotencia debe haber quedado registrada como FAILED
      const idemp = await tx.inventoryIdempotencyKey.findFirst({
        where: { key: failedKey },
      });
      assert.ok(idemp);
      assert.equal(idemp.status, 'FAILED', 'La transacción fallida debe quedar marcada como FAILED para reintentos');
    });
  });

  it('3. Venta a crédito (Fiado): actualiza deuda de cliente y rechaza si excede límite de crédito', async () => {
    // 3.1 Venta a crédito exitosa (dentro del cupo de $50,000)
    const creditKey = 'pos-credit-sale-001';
    const creditRes = await coordinator.executeCheckout(
      TEST_TENANT_ID,
      TEST_USER_ID,
      creditKey,
      {
        branchId: TEST_BRANCH_ID,
        items: [
          {
            productId: TEST_PRODUCT_ID,
            variantId: TEST_VARIANT_ID,
            warehouseId: TEST_WAREHOUSE_ID,
            quantity: 2,
            unitPrice: 3000,
            taxRate: 19,
          },
        ],
        payment: {
          method: 'CREDITO_FIADO',
          customerId: TEST_CUSTOMER_ID,
        },
      },
    );

    assert.equal(creditRes.success, true);
    assert.equal(creditRes.total, 7140);

    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const customer = await tx.thirdParty.findUnique({
        where: { id: TEST_CUSTOMER_ID },
      });
      assert.equal(Number(customer?.currentDebt), 7140, 'La deuda actual del cliente debe ser $7,140');

      const creditTx = await tx.creditTransaction.findFirst({
        where: { thirdPartyId: TEST_CUSTOMER_ID },
      });
      assert.ok(creditTx);
      assert.equal(creditTx.type, 'CHARGE_CREDIT_SALE');
      assert.equal(Number(creditTx.amount), 7140);
    });

    // 3.2 Venta a crédito que supera el límite ($50,000 - $7,140 = cupo restante $42,860)
    // Intentar comprar 15 unidades * $3000 * 1.19 = $53,550 > cupo disponible
    await assert.rejects(
      async () => {
        await coordinator.executeCheckout(
          TEST_TENANT_ID,
          TEST_USER_ID,
          'pos-credit-sale-exceeded',
          {
            branchId: TEST_BRANCH_ID,
            items: [
              {
                productId: TEST_PRODUCT_ID,
                variantId: TEST_VARIANT_ID,
                warehouseId: TEST_WAREHOUSE_ID,
                quantity: 15,
                unitPrice: 3000,
                taxRate: 19,
              },
            ],
            payment: {
              method: 'CREDITO_FIADO',
              customerId: TEST_CUSTOMER_ID,
            },
          },
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('excede el cupo disponible'));
        return true;
      },
    );

    // Deuda no debe haber cambiado
    await withTenantContext(runtimePrisma, TEST_TENANT_ID, async (tx) => {
      const customer = await tx.thirdParty.findUnique({
        where: { id: TEST_CUSTOMER_ID },
      });
      assert.equal(Number(customer?.currentDebt), 7140, 'La deuda no debe alterarse tras la reversión');
    });
  });
});
