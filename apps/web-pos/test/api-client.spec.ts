import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  UniSaasApiClient,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
} from '../src/lib/api-client.ts';

describe('UniSaasApiClient Unit Tests', () => {
  const originalFetch = globalThis.fetch;
  let client: UniSaasApiClient;

  beforeEach(() => {
    client = new UniSaasApiClient('http://test-api:3000/api/v1');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('debe inyectar token Bearer y X-Tenant-Id en las peticiones HTTP', async () => {
    let capturedUrl = '';
    let capturedHeaders: Headers | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify([{ sessionId: 's1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    client.setToken('jwt-super-secret-token');
    client.setTenantId('tenant-uuid-1111');

    const result = await client.auth.getSessions();

    assert.equal(capturedUrl, 'http://test-api:3000/api/v1/auth/sessions');
    assert.equal(capturedHeaders?.get('Authorization'), 'Bearer jwt-super-secret-token');
    assert.equal(capturedHeaders?.get('X-Tenant-Id'), 'tenant-uuid-1111');
    assert.equal(capturedHeaders?.get('Content-Type'), 'application/json');
    assert.deepEqual(result, [{ sessionId: 's1' }]);
  });

  it('debe inyectar cabecera Idempotency-Key y detectar x-idempotent-replay', async () => {
    let capturedHeaders: Headers | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          invoiceId: 'inv-123',
          consecutive: 'POS-20261101-00001',
          total: 50000,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-idempotent-replay': 'true',
          },
        },
      );
    }) as any;

    const key = 'idem-uuid-9999';
    const result = await client.checkout.execute(
      {
        branchId: 'branch-1',
        items: [],
        payment: { method: 'EFECTIVO' },
      },
      key,
    );

    assert.equal(capturedHeaders?.get('Idempotency-Key'), key);
    assert.equal(result.isReplay, true);
    assert.equal(result.consecutive, 'POS-20261101-00001');
  });

  it('debe mapear HTTP 401 a UnauthorizedError', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    await assert.rejects(
      async () => {
        await client.auth.getSessions();
      },
      (err: any) => {
        assert(err instanceof UnauthorizedError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, 'Token expired');
        return true;
      },
    );
  });

  it('debe mapear HTTP 403 a ForbiddenError', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Permiso denegado para esta sucursal' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    await assert.rejects(
      async () => {
        await client.inventory.getProducts();
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.message, 'Permiso denegado para esta sucursal');
        return true;
      },
    );
  });

  it('debe mapear HTTP 404 a NotFoundError', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Producto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    await assert.rejects(
      async () => {
        await client.inventory.getProductById('ID-INEXISTENTE');
      },
      (err: any) => {
        assert(err instanceof NotFoundError);
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });

  it('debe mapear HTTP 409 a ConflictError', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Stock insuficiente para el producto' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    await assert.rejects(
      async () => {
        await client.checkout.execute(
          {
            branchId: 'b1',
            items: [],
            payment: { method: 'EFECTIVO' },
          },
          'key-1',
        );
      },
      (err: any) => {
        assert(err instanceof ConflictError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.message, 'Stock insuficiente para el producto');
        return true;
      },
    );
  });

  it('debe mapear HTTP 503 a ServiceUnavailableError con retryAfter', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Base de datos temporalmente no disponible' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'retry-after': '10',
        },
      });
    }) as any;

    await assert.rejects(
      async () => {
        await client.health.check();
      },
      (err: any) => {
        assert(err instanceof ServiceUnavailableError);
        assert.equal(err.statusCode, 503);
        assert.equal(err.retryAfter, 10);
        return true;
      },
    );
  });

  it('debe mapear errores de red / desconexión a ServiceUnavailableError', async () => {
    globalThis.fetch = (async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    }) as any;

    await assert.rejects(
      async () => {
        await client.inventory.getProducts();
      },
      (err: any) => {
        assert(err instanceof ServiceUnavailableError);
        assert.match(err.message, /Fallo de conexión al API Gateway/);
        return true;
      },
    );
  });
});
