import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Environment } from '../config/environment.js';

describe('Certificación RLS - Reutilización de Conexiones del Pool y Transaccionalidad', () => {
  let runtimePrisma: PrismaClient;

  const TENANT_A = Environment.tenants.tenantA.id;
  const TENANT_B = Environment.tenants.tenantB.id;
  const BRANCH_A = Environment.tenants.tenantA.branchId;
  const BRANCH_B = Environment.tenants.tenantB.branchId;

  before(async () => {
    // Instanciar cliente Prisma conectado con el rol app_runtime (con pool por defecto)
    runtimePrisma = new PrismaClient({
      datasources: {
        db: {
          url: Environment.dbRuntimeUrl,
        },
      },
    });
    await runtimePrisma.$connect();
  });

  after(async () => {
    if (runtimePrisma) {
      await runtimePrisma.$disconnect();
    }
  });

  it('1. SET LOCAL app.current_tenant_id y SET LOCAL ROLE no persisten al finalizar la transacción', async () => {
    // 1. Ejecutar transacción con Tenant A
    await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
      const branches = await tx.branch.findMany();
      assert.ok(branches.length > 0, 'Tenant A debe tener sucursales');
      const branchIds = branches.map((b) => b.id);
      assert.ok(branchIds.includes(BRANCH_A), 'Debe incluir sucursal A');
      assert.ok(!branchIds.includes(BRANCH_B), 'No debe incluir sucursal B');
    });

    // 2. Consulta sin transacción / sin contexto fuera de withTenantContext
    // Al reutilizar la conexión del pool, SET LOCAL ya no debe tener efecto
    const rowsOutsideContext = await runtimePrisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM branches;
    `;
    assert.equal(
      Number(rowsOutsideContext[0].count),
      0,
      'Fuera de la transacción con contexto, la consulta debe retornar 0 registros',
    );
  });

  it('2. Ejecución secuencial alternada sobre la misma conexión física no conserva contexto residual', async () => {
    for (let i = 0; i < 10; i++) {
      // Turno Tenant A
      await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
        const branchesA = await tx.branch.findMany();
        assert.ok(!branchesA.some((b) => b.id === BRANCH_B), `Iter ${i}: Tenant A vio registro de B`);
      });

      // Turno Tenant B
      await withTenantContext(runtimePrisma, TENANT_B, async (tx) => {
        const branchesB = await tx.branch.findMany();
        assert.ok(!branchesB.some((b) => b.id === BRANCH_A), `Iter ${i}: Tenant B vio registro de A`);
      });
    }
  });

  it('3. Alta concurrencia entrelazada (50 transacciones simultáneas) garantiza cero contaminación cruzada', async () => {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 50; i++) {
      const isTenantA = i % 2 === 0;
      const targetTenant = isTenantA ? TENANT_A : TENANT_B;
      const forbiddenBranch = isTenantA ? BRANCH_B : BRANCH_A;

      promises.push(
        withTenantContext(runtimePrisma, targetTenant, async (tx) => {
          const branches = await tx.branch.findMany();
          assert.ok(
            !branches.some((b) => b.id === forbiddenBranch),
            `Transacción concurrente ${i} para ${targetTenant} expuso registro prohibido ${forbiddenBranch}`,
          );
        }),
      );
    }

    await Promise.all(promises);
  });

  it('4. Rollback por error transaccional revierte limpiamente el contexto y no contamina la siguiente conexión', async () => {
    // 1. Provocar un error dentro de una transacción con Tenant A
    await assert.rejects(
      async () => {
        await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
          await tx.branch.findMany();
          throw new Error('Fallo intencional para forzar ROLLBACK');
        });
      },
      /Fallo intencional para forzar ROLLBACK/,
    );

    // 2. Ejecutar inmediatamente con Tenant B
    await withTenantContext(runtimePrisma, TENANT_B, async (tx) => {
      const branches = await tx.branch.findMany();
      assert.ok(
        !branches.some((b) => b.id === BRANCH_A),
        'Tras un ROLLBACK, la siguiente transacción no debe heredar contexto residual',
      );
    });
  });
});

