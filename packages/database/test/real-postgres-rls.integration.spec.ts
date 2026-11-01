import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { withTenantContext } from '../src/tenant-context.js';

describe('Prueba de Integración RLS Real en PostgreSQL (NestJS / Prisma Engine)', () => {
  let runtimePrisma: PrismaClient;
  let adminPrisma: PrismaClient;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const BRANCH_A_ID = 'a1111111-9999-9999-9999-111111111111';

  before(async () => {
    // Cliente de ejecución NestJS (conectado con el rol de aplicación app_runtime)
    runtimePrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
        },
      },
    });

    // Cliente administrativo (para configuración y verificación de asunción de rol)
    adminPrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://saas_migration_admin:postgres@localhost:5432/saas_contable_db?schema=public',
        },
      },
    });

    await runtimePrisma.$connect();
    await adminPrisma.$connect();
  });

  after(async () => {
    if (runtimePrisma) {
      await runtimePrisma.$disconnect();
    }
    if (adminPrisma) {
      await adminPrisma.$disconnect();
    }
  });

  it('1. Tenant A puede crear y consultar sus propios registros mediante withTenantContext', async () => {
    const result = await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
      // Limpiar y recrear sucursal para Tenant A
      await tx.branch.deleteMany({ where: { id: BRANCH_A_ID } });

      const created = await tx.branch.create({
        data: {
          id: BRANCH_A_ID,
          tenantId: TENANT_A,
          code: 'SUC-PRISMA-A',
          name: 'Sucursal Prisma Tenant A',
          address: 'Av Principal #123',
          isActive: true,
        },
      });

      const branches = await tx.branch.findMany({ where: { id: BRANCH_A_ID } });
      return { created, count: branches.length };
    });

    assert.equal(result.created.id, BRANCH_A_ID);
    assert.equal(result.created.tenantId, TENANT_A);
    assert.equal(result.count, 1);
  });

  it('2. Tenant B no puede visualizar registros pertenecientes a Tenant A', async () => {
    const branchesVisibleToB = await withTenantContext(runtimePrisma, TENANT_B, async (tx) => {
      const allBranches = await tx.branch.findMany();
      const branchA = await tx.branch.findFirst({
        where: { id: BRANCH_A_ID },
      });

      return { allBranches, branchA };
    });

    assert.equal(branchesVisibleToB.branchA, null);
    const leakedBranch = branchesVisibleToB.allBranches.find((b) => b.id === BRANCH_A_ID);
    assert.equal(leakedBranch, undefined);
  });

  it('3. Tenant B no puede modificar (UPDATE) registros de Tenant A', async () => {
    const updateResult = await withTenantContext(runtimePrisma, TENANT_B, async (tx) => {
      return tx.branch.updateMany({
        where: { id: BRANCH_A_ID },
        data: { name: 'VULNERADO_POR_TENANT_B' },
      });
    });

    // RLS previene que Tenant B vea la fila de Tenant A, por lo que afecta 0 filas
    assert.equal(updateResult.count, 0);

    // Verificar que el nombre original sigue intacto para Tenant A
    const originalBranch = await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
      return tx.branch.findUnique({ where: { id: BRANCH_A_ID } });
    });
    assert.equal(originalBranch?.name, 'Sucursal Prisma Tenant A');
  });

  it('4. Tenant B no puede eliminar (DELETE) registros de Tenant A', async () => {
    const deleteResult = await withTenantContext(runtimePrisma, TENANT_B, async (tx) => {
      return tx.branch.deleteMany({
        where: { id: BRANCH_A_ID },
      });
    });

    // RLS previene que Tenant B vea la fila de Tenant A, por lo que afecta 0 filas
    assert.equal(deleteResult.count, 0);

    // Verificar que el registro aún existe para Tenant A
    const branchStillExists = await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
      return tx.branch.findUnique({ where: { id: BRANCH_A_ID } });
    });
    assert.ok(branchStillExists !== null);
    assert.equal(branchStillExists?.id, BRANCH_A_ID);
  });

  it('5. Consultas directas sin contexto de tenant en app_runtime retornan 0 registros (RLS Activo)', async () => {
    // Fuera de withTenantContext, app_runtime carece de app.current_tenant_id (evalúa a NULL)
    // Debido a las políticas RLS, no expone ningún registro multi-tenant
    const directBranches = await runtimePrisma.branch.findMany({
      where: { id: BRANCH_A_ID },
    });

    assert.equal(directBranches.length, 0);
  });

  it('6. Un error y rollback en withTenantContext no deja contexto residual en la conexión', async () => {
    await assert.rejects(
      async () => {
        await withTenantContext(runtimePrisma, TENANT_A, async (tx) => {
          await tx.branch.findMany();
          throw new Error('Simulated domain failure requiring ROLLBACK');
        });
      },
      {
        message: 'Simulated domain failure requiring ROLLBACK',
      },
    );

    // Tras el rollback, la conexión devuelta al pool no retiene app.current_tenant_id
    const subsequentDirectResult = await runtimePrisma.branch.findMany({
      where: { id: BRANCH_A_ID },
    });
    assert.equal(subsequentDirectResult.length, 0);
  });

  it('7. El rol de conexión administrativo asume app_runtime y queda estrictamente aislado en withTenantContext', async () => {
    // Si la conexión entra con saas_migration_admin, withTenantContext ejecuta SET LOCAL ROLE app_runtime
    const isolationUnderAdmin = await withTenantContext(adminPrisma, TENANT_B, async (tx) => {
      // Intentar ver registros de Tenant A estando en contexto B
      return tx.branch.findMany({ where: { id: BRANCH_A_ID } });
    });

    // A pesar de que la conexión física inició como saas_migration_admin,
    // SET LOCAL ROLE app_runtime asegura que se aplique RLS estricto y devuelva 0 filas
    assert.equal(isolationUnderAdmin.length, 0);
  });
});
