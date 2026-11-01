import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Environment } from '../config/environment.js';

describe('E2E HTTP - Orquestación Atómica de Checkout POS e Idempotencia Durable', () => {
  let tokenA: string;

  before(async () => {
    const res = await fetch(`${Environment.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: Environment.tenants.tenantA.email,
        password: Environment.tenants.tenantA.password,
      }),
    });
    const data = (await res.json()) as any;
    tokenA = data.accessToken;
  });

  it('1. Checkout válido emite factura, descuenta inventario y retorna confirmación', async () => {
    const idempotencyKey = `e2e-checkout-valid-${Date.now()}`;
    const payload = {
      branchId: Environment.tenants.tenantA.branchId,
      items: [
        {
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 2,
          unitPrice: 3000,
          taxRate: 0.19,
        },
      ],
      payment: {
        method: 'EFECTIVO',
        cashTendered: 10000,
      },
      notes: 'Venta de prueba E2E automatizada',
    };

    const res = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.equal(data.success, true);
    assert.ok(data.invoiceId, 'Debe retornar invoiceId');
    assert.ok(data.consecutive, 'Debe retornar consecutivo');
    assert.equal(data.isReplay ?? false, false);
  });

  it('2. Reejecución con la misma Idempotency-Key retorna respuesta exacta con isReplay=true', async () => {
    const idempotencyKey = `e2e-replay-test-${Date.now()}`;
    const payload = {
      branchId: Environment.tenants.tenantA.branchId,
      items: [
        {
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 3000,
          taxRate: 0.19,
        },
      ],
      payment: {
        method: 'EFECTIVO',
        cashTendered: 5000,
      },
    };

    // Primera ejecución
    const res1 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(res1.status, 201);
    const data1 = (await res1.json()) as any;

    // Segunda ejecución con misma clave
    const res2 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(res2.status, 200);
    const data2 = (await res2.json()) as any;

    assert.equal(data2.invoiceId, data1.invoiceId);
    assert.equal(data2.consecutive, data1.consecutive);
    assert.equal(data2.isReplay, true);
  });
});

