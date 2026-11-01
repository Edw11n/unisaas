import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withTenantContext, TenantContextException } from '../src/tenant-context.js';
import type { Prisma, PrismaClient } from '@prisma/client';

describe('Tenant Context Isolation Helper (withTenantContext)', () => {
  it('rechaza tenantId ausente, vacío o que no sea cadena', async () => {
    const dummyClient = {} as PrismaClient;

    await assert.rejects(
      () => withTenantContext(dummyClient, '', async () => {}),
      TenantContextException,
    );

    await assert.rejects(
      () => withTenantContext(dummyClient, null as unknown as string, async () => {}),
      TenantContextException,
    );
  });

  it('rechaza tenantIds que no cumplan el formato UUID para evitar inyección SQL', async () => {
    const dummyClient = {} as PrismaClient;

    await assert.rejects(
      () => withTenantContext(dummyClient, "malicious'; DROP TABLE tenants; --", async () => {}),
      (err: Error) => {
        assert.ok(err instanceof TenantContextException);
        assert.ok(err.message.includes('Formato de tenantId inválido'));
        return true;
      },
    );

    await assert.rejects(
      () => withTenantContext(dummyClient, '12345', async () => {}),
      TenantContextException,
    );
  });

  it('ejecuta SET LOCAL ROLE app_runtime y SET LOCAL app.current_tenant_id en el cliente transaccional', async () => {
    const executedRawQueries: string[] = [];
    const validTenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    // Mock del cliente transaccional
    const mockTx = {
      $executeRawUnsafe: async (sql: string) => {
        executedRawQueries.push(sql);
        return 1;
      },
      product: {
        findMany: async () => [{ id: 'prod-1', name: 'Arroz' }],
      },
    } as unknown as Prisma.TransactionClient;

    // Mock de PrismaClient con $transaction interactivo
    const mockPrisma = {
      $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        return fn(mockTx);
      },
    } as unknown as PrismaClient;

    let callbackExecuted = false;
    const result = await withTenantContext(mockPrisma, validTenantId, async (tx) => {
      callbackExecuted = true;
      // Verificar que tx recibido es exactamente el cliente transaccional
      assert.equal(tx, mockTx);
      return (tx as unknown as { product: { findMany: () => Promise<unknown> } }).product.findMany();
    });

    assert.equal(callbackExecuted, true);
    assert.deepEqual(result, [{ id: 'prod-1', name: 'Arroz' }]);

    // Verificar que los dos comandos SET LOCAL se ejecutaron en orden
    assert.equal(executedRawQueries.length, 2);
    assert.equal(executedRawQueries[0], 'SET LOCAL ROLE app_runtime');
    assert.equal(
      executedRawQueries[1],
      `SET LOCAL app.current_tenant_id = '${validTenantId}'`,
    );
  });

  it('propaga excepciones lanzadas dentro del callback para detonar el ROLLBACK', async () => {
    const validTenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const mockTx = {
      $executeRawUnsafe: async () => 1,
    } as unknown as Prisma.TransactionClient;

    const mockPrisma = {
      $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        return fn(mockTx);
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      () =>
        withTenantContext(mockPrisma, validTenantId, async () => {
          throw new Error('Fallo de negocio en checkout');
        }),
      (err: Error) => {
        assert.equal(err.message, 'Fallo de negocio en checkout');
        return true;
      },
    );
  });
});

