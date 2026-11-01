import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Environment } from '../config/environment.js';

describe('E2E HTTP - Aislamiento Multi-Tenant y Prevención de Spoofing', () => {
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // 1. Iniciar sesión Tenant A
    const resA = await fetch(`${Environment.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: Environment.tenants.tenantA.email,
        password: Environment.tenants.tenantA.password,
      }),
    });
    const dataA = (await resA.json()) as any;
    assert.equal(resA.status, 200, 'Login Tenant A debe ser 200');
    tokenA = dataA.accessToken;

    // 2. Iniciar sesión Tenant B
    const resB = await fetch(`${Environment.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: Environment.tenants.tenantB.email,
        password: Environment.tenants.tenantB.password,
      }),
    });
    const dataB = (await resB.json()) as any;
    assert.equal(resB.status, 200, 'Login Tenant B debe ser 200');
    tokenB = dataB.accessToken;
  });

  it('1. Tenant A recibe únicamente sus propios productos y ningún producto del Tenant B', async () => {
    const res = await fetch(`${Environment.apiBaseUrl}/inventory/products`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const products = (await res.json()) as any[];
    assert.ok(products.length > 0, 'Tenant A debe tener productos');

    for (const p of products) {
      assert.equal(p.tenantId, Environment.tenants.tenantA.id);
      assert.notEqual(p.id, Environment.tenants.tenantB.productId);
    }
  });

  it('2. Tenant B recibe únicamente sus propios productos y ningún producto del Tenant A', async () => {
    const res = await fetch(`${Environment.apiBaseUrl}/inventory/products`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(res.status, 200);
    const products = (await res.json()) as any[];
    assert.ok(products.length > 0, 'Tenant B debe tener productos');

    for (const p of products) {
      assert.equal(p.tenantId, Environment.tenants.tenantB.id);
      assert.notEqual(p.id, Environment.tenants.tenantA.productId);
    }
  });

  it('3. Intento de suplantación de cabecera X-Tenant-Id es bloqueado activamente con HTTP 403', async () => {
    // Tenant A envía token de A pero fuerza cabecera de Tenant B
    const res = await fetch(`${Environment.apiBaseUrl}/inventory/products`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'X-Tenant-Id': Environment.tenants.tenantB.id,
      },
    });
    // Blindaje de Inquilino: el Guard rechaza la solicitud cruzada con 403 Forbidden
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.match(body.message, /No está autorizado para operar bajo el inquilino solicitado/);
  });

  it('4. Checkout cruzado (Tenant A intentando facturar bodega de Tenant B) es rechazado', async () => {
    const crossCheckoutPayload = {
      branchId: Environment.tenants.tenantA.branchId,
      items: [
        {
          productId: Environment.tenants.tenantB.productId, // Producto de B
          variantId: Environment.tenants.tenantB.variantId,
          warehouseId: Environment.tenants.tenantB.warehouseId, // Bodega de B
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

    const res = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `e2e-cross-check-${Date.now()}`,
      },
      body: JSON.stringify(crossCheckoutPayload),
    });

    // Debe ser rechazado (404 por RLS que no encuentra la bodega o producto de B, o 400)
    assert.ok(
      res.status >= 400,
      `Checkout cruzado debió ser rechazado pero respondió HTTP ${res.status}`,
    );
  });
});
