import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withTenantContext, TenantContextException } from '@unisaas/database';
import { TenantController } from '@unisaas/identity';
import { UserController } from '@unisaas/identity';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('API Gateway - Aislamiento Multi-Inquilino de Seguridad RLS (@unisaas/api-gateway)', () => {
  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';

  it('withTenantContext rechaza tenantId nulo, indefinido o no-UUID', async () => {
    const mockPrisma = {} as any;

    await assert.rejects(
      async () => withTenantContext(mockPrisma, '', async () => {}),
      (err: any) => err instanceof TenantContextException,
    );

    await assert.rejects(
      async () => withTenantContext(mockPrisma, 'malicious-injected-string', async () => {}),
      (err: any) => err instanceof TenantContextException,
    );
  });

  it('withTenantContext configura app.current_tenant_id y aísla la transacción', async () => {
    const executedQueries: string[] = [];

    const mockTx = {
      $executeRawUnsafe: async (sql: string) => {
        executedQueries.push(sql);
      },
      product: {
        findMany: async () => [
          { id: 'prod-A', name: 'Producto de Tenant A', tenantId: tenantA },
        ],
      },
    };

    const mockPrisma = {
      $transaction: async (cb: any) => cb(mockTx),
    } as any;

    const result = await withTenantContext(mockPrisma, tenantA, async (tx) => {
      return tx.product.findMany();
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].tenantId, tenantA);
    assert.ok(
      executedQueries.some((q) => q.includes('SET LOCAL ROLE app_runtime')),
      'Debe conmutar a app_runtime para aplicar políticas RLS con privilegios mínimos',
    );
    assert.ok(
      executedQueries.some((q) => q.includes(`SET LOCAL app.current_tenant_id = '${tenantA}'`)),
      'Debe inyectar la variable de sesión app.current_tenant_id con el UUID del inquilino',
    );
  });

  it('Inquilino A y Inquilino B reciben contextos independientes y aislados', async () => {
    const tenantConfigs: string[] = [];

    const createMockPrisma = (expectedTenant: string) => ({
      $transaction: async (cb: any) => {
        const tx = {
          $executeRawUnsafe: async (sql: string) => {
            if (sql.includes('SET LOCAL app.current_tenant_id')) {
              tenantConfigs.push(sql);
            }
          },
          invoice: {
            findMany: async () => [{ tenantId: expectedTenant }],
          },
        };
        return cb(tx);
      },
    });

    const resA = await withTenantContext(createMockPrisma(tenantA) as any, tenantA, async (tx) => {
      return tx.invoice.findMany();
    });

    const resB = await withTenantContext(createMockPrisma(tenantB) as any, tenantB, async (tx) => {
      return tx.invoice.findMany();
    });

    assert.equal(resA[0].tenantId, tenantA);
    assert.equal(resB[0].tenantId, tenantB);
    assert.ok(tenantConfigs[0].includes(tenantA));
    assert.ok(tenantConfigs[1].includes(tenantB));
    assert.notEqual(resA[0].tenantId, resB[0].tenantId);
  });

  it('Ataque 1: Usuario de Tenant A intentando acceder a sucursales de Tenant B vía parámetro URL es bloqueado con 403', async () => {
    const controller = new TenantController({} as any);

    const reqUserA: any = {
      tenantId: tenantA,
      user: { id: 'u1', tenantId: tenantA, roles: ['ADMIN'] },
    };

    // Intento de llamar a getBranches pasando el ID de Tenant B en la URL
    await assert.rejects(
      async () => controller.getBranches(reqUserA, tenantB),
      (err: any) => err instanceof ForbiddenException,
    );

    // Intento de llamar a getTenant pasando el ID de Tenant B en la URL
    await assert.rejects(
      async () => controller.getTenant(reqUserA, tenantB),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('Ataque 2: Manipulación del header X-Tenant-Id por usuario de Tenant A (incluso OWNER) es bloqueado con 403', async () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as any,
      {
        verifyAsync: async () => ({
          sub: 'u-owner-A',
          tenantId: tenantA,
          email: 'owner@tenantA.com',
          roles: ['OWNER'], // Propietario de la Empresa A
          jti: 'jti-1',
        }),
      } as any,
      { getSession: async () => ({ sessionId: 'jti-1' }) } as any,
      { isTokenBlacklisted: async () => false } as any,
    );

    const mockReq: any = {
      headers: {
        authorization: 'Bearer token-owner-A',
        'x-tenant-id': tenantB, // Intenta suplantar la Empresa B
      },
    };

    const mockContext: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => mockReq,
      }),
    };

    await assert.rejects(
      async () => guard.canActivate(mockContext),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('Ataque 3: Escalación de privilegios - Cajero intentando crear un usuario OWNER es bloqueado con 403', async () => {
    const controller = new UserController({} as any);

    const reqCashier: any = {
      tenantId: tenantA,
      user: { id: 'u-cashier', tenantId: tenantA, roles: ['CASHIER'] },
    };

    await assert.rejects(
      async () => controller.createUser(reqCashier, {
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: '99999999',
        email: 'nuevo-owner@tenantA.com',
        password: 'password123',
        fullName: 'Nuevo Owner Malicioso',
        role: 'OWNER' as any,
      }),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('Ataque 4: Consulta de recurso perteneciente a Tenant B bajo RLS de Tenant A retorna 404 (Zero Leakage)', async () => {
    // Simular que en la base de datos la tabla de productos bajo el RLS de Tenant A no encuentra el producto de Tenant B
    const mockPrisma = {
      $transaction: async (cb: any) => cb({
        $executeRawUnsafe: async () => {},
        product: {
          findUnique: async () => null, // RLS en PostgreSQL descarta la fila de Tenant B
        },
      }),
    } as any;

    const { ProductService } = await import('@unisaas/inventory');
    const productService = new ProductService(mockPrisma);

    await assert.rejects(
      async () => productService.getProductById(tenantA, 'prod-belonging-to-tenant-B'),
      (err: any) => err instanceof NotFoundException,
    );
  });
});
