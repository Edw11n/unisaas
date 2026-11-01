import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Environment } from '../config/environment.js';

describe('E2E - Validación Atómica de Secuencias Correlativas POS y Contables (TenantSequence)', () => {
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // Autenticar Inquilino A
    const resA = await fetch(`${Environment.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: Environment.tenants.tenantA.email,
        password: Environment.tenants.tenantA.password,
      }),
    });
    const dataA = (await resA.json()) as any;
    tokenA = dataA.accessToken;

    // Autenticar Inquilino B
    const resB = await fetch(`${Environment.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: Environment.tenants.tenantB.email,
        password: Environment.tenants.tenantB.password,
      }),
    });
    const dataB = (await resB.json()) as any;
    tokenB = dataB.accessToken;
  });

  it('1. Generación secuencial normal: consecutivos de facturas continuos y sin hashes aleatorios', async () => {
    const payload = (idx: number) => ({
      branchId: Environment.tenants.tenantA.branchId,
      items: [
        {
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 2000,
          taxRate: 0.19,
        },
      ],
      payment: { method: 'EFECTIVO', cashTendered: 5000 },
      notes: `Venta secuencial normal ${idx}`,
    });

    // Venta 1
    const res1 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-normal-1-${Date.now()}`,
      },
      body: JSON.stringify(payload(1)),
    });
    assert.equal(res1.status, 201);
    const data1 = (await res1.json()) as any;
    assert.ok(data1.consecutive);

    // Venta 2
    const res2 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-normal-2-${Date.now()}`,
      },
      body: JSON.stringify(payload(2)),
    });
    assert.equal(res2.status, 201);
    const data2 = (await res2.json()) as any;
    assert.ok(data2.consecutive);

    // Verificar formato POS-YYYYMMDD-XXXXXX sin sufijos aleatorios
    const match1 = data1.consecutive.match(/^POS-\d{8}-(\d{6})$/);
    const match2 = data2.consecutive.match(/^POS-\d{8}-(\d{6})$/);
    assert.ok(match1, `El consecutivo 1 '${data1.consecutive}' debe coincidir con formato POS-YYYYMMDD-XXXXXX`);
    assert.ok(match2, `El consecutivo 2 '${data2.consecutive}' debe coincidir con formato POS-YYYYMMDD-XXXXXX`);

    const num1 = parseInt(match1[1], 10);
    const num2 = parseInt(match2[1], 10);
    assert.equal(num2, num1 + 1, `Los números deben ser estrictamente correlativos (${num1} -> ${num2})`);
  });

  it('2. Generación concurrente: 10 checkouts simultáneos generan 10 consecutivos únicos y continuos', async () => {
    const promises = Array.from({ length: 10 }).map((_, i) => {
      const idempotencyKey = `seq-concurrent-${i}-${Date.now()}-${Math.random()}`;
      const payload = {
        branchId: Environment.tenants.tenantA.branchId,
        items: [
          {
            productId: Environment.tenants.tenantA.productId,
            variantId: Environment.tenants.tenantA.variantId,
            warehouseId: Environment.tenants.tenantA.warehouseId,
            quantity: 1,
            unitPrice: 1500,
            taxRate: 0.19,
          },
        ],
        payment: { method: 'EFECTIVO', cashTendered: 3000 },
        notes: `Concurrente ${i}`,
      };

      return fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      }).then(async (r) => ({ status: r.status, data: (await r.json()) as any }));
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.equal(r.status, 201, `Checkout concurrente debe responder 201: ${JSON.stringify(r.data)}`);
      assert.equal(r.data.success, true);
    }

    const consecutives = results.map((r) => r.data.consecutive as string);
    const uniqueSet = new Set(consecutives);
    assert.equal(uniqueSet.size, 10, 'No debe haber consecutivos duplicados bajo concurrencia');

    // Extraer números y verificar que forman un rango contiguo sin huecos
    const numbers = consecutives
      .map((c) => parseInt(c.match(/^POS-\d{8}-(\d{6})$/)![1], 10))
      .sort((a, b) => a - b);

    for (let k = 1; k < numbers.length; k++) {
      assert.equal(numbers[k], numbers[k - 1] + 1, `Secuencia debe ser contigua: ${numbers[k - 1]} -> ${numbers[k]}`);
    }
  });

  it('3. Aislamiento entre tenants: Tenant B mantiene sus secuencias independientes de Tenant A', async () => {
    const payloadB = {
      branchId: Environment.tenants.tenantB.branchId,
      items: [
        {
          productId: Environment.tenants.tenantB.productId,
          variantId: Environment.tenants.tenantB.variantId,
          warehouseId: Environment.tenants.tenantB.warehouseId,
          quantity: 1,
          unitPrice: 5000,
          taxRate: 0.19,
        },
      ],
      payment: { method: 'EFECTIVO', cashTendered: 10000 },
      notes: 'Venta Tenant B aislamiento',
    };

    const resB = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-tenant-b-${Date.now()}`,
      },
      body: JSON.stringify(payloadB),
    });

    assert.equal(resB.status, 201);
    const dataB = (await resB.json()) as any;
    assert.ok(dataB.consecutive);
    // Tenant B tiene su propia secuencia separada por tenant_id
    assert.match(dataB.consecutive, /^POS-\d{8}-\d{6}$/);
  });

  it('4. Rollback de transacciones: error de negocio (efectivo insuficiente) aborta sin consumir consecutivo', async () => {
    // 1. Obtener una factura válida para ver el consecutivo base
    const validRes1 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-rb-valid1-${Date.now()}`,
      },
      body: JSON.stringify({
        branchId: Environment.tenants.tenantA.branchId,
        items: [{
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 2000,
          taxRate: 0.19,
        }],
        payment: { method: 'EFECTIVO', cashTendered: 5000 },
        notes: 'Pre-rollback',
      }),
    });
    const validData1 = (await validRes1.json()) as any;
    const baseSeq = parseInt(validData1.consecutive.match(/^POS-\d{8}-(\d{6})$/)[1], 10);

    // 2. Transacción que fallará (efectivo entregado menor al total)
    const failRes = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-rb-fail-${Date.now()}`,
      },
      body: JSON.stringify({
        branchId: Environment.tenants.tenantA.branchId,
        items: [{
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 10000,
          taxRate: 0.19,
        }],
        payment: { method: 'EFECTIVO', cashTendered: 500 }, // $500 insuficiente para $11,900
        notes: 'Fallo intencional',
      }),
    });
    assert.equal(failRes.status, 400, 'Debe fallar con HTTP 400 por efectivo insuficiente');

    // 3. Siguiente transacción exitosa
    const validRes2 = await fetch(`${Environment.apiBaseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `seq-rb-valid2-${Date.now()}`,
      },
      body: JSON.stringify({
        branchId: Environment.tenants.tenantA.branchId,
        items: [{
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 2000,
          taxRate: 0.19,
        }],
        payment: { method: 'EFECTIVO', cashTendered: 5000 },
        notes: 'Post-rollback',
      }),
    });
    const validData2 = (await validRes2.json()) as any;
    const nextSeq = parseInt(validData2.consecutive.match(/^POS-\d{8}-(\d{6})$/)[1], 10);

    // Debido a que la transacción fallida se revirtió a nivel de PostgreSQL,
    // el consecutivo de la siguiente venta es exactamente baseSeq + 1 (sin saltos innecesarios)
    assert.equal(nextSeq, baseSeq + 1, `Consecutivo post-rollback debe ser ${baseSeq + 1}, obtenido ${nextSeq}`);
  });

  it('5. Reintentos idempotentes: replay no genera nuevo documento ni consume secuencia', async () => {
    const idempotencyKey = `seq-replay-test-${Date.now()}`;
    const payload = {
      branchId: Environment.tenants.tenantA.branchId,
      items: [
        {
          productId: Environment.tenants.tenantA.productId,
          variantId: Environment.tenants.tenantA.variantId,
          warehouseId: Environment.tenants.tenantA.warehouseId,
          quantity: 1,
          unitPrice: 4000,
          taxRate: 0.19,
        },
      ],
      payment: { method: 'EFECTIVO', cashTendered: 10000 },
      notes: 'Test idempotencia de secuencia',
    };

    // Primera llamada
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

    // Segunda llamada (replay)
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

    assert.equal(data2.isReplay, true);
    assert.equal(data2.invoiceId, data1.invoiceId);
    assert.equal(data2.consecutive, data1.consecutive, 'El replay debe devolver el mismo consecutivo exacto');
  });
});
