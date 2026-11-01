import http from 'k6/http';
import { check } from 'k6';
import { getAuthToken } from '../helpers/auth.js';

export const options = {
  scenarios: {
    checkout_constant: {
      executor: 'constant-arrival-rate',
      rate: 25, // 25 iter/s * 2 req/iter = 50 req/s
      timeUnit: '1s',
      duration: __ENV.TEST_DURATION || '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<=350'],
    http_req_failed: ['rate<0.001'],
  },
};

export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
  const auth = getAuthToken(
    baseUrl,
    __ENV.AUTH_EMAIL || 'cajero@tenant-1111.com',
    __ENV.AUTH_PASSWORD || 'password123',
  );

  // Obtener catálogo de productos para distribuir ventas entre múltiples SKUs
  const prodRes = http.get(`${baseUrl}/inventory/products`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const products = prodRes.json();
  const items = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (p.variants && p.variants.length > 0) {
      items.push({
        productId: p.id,
        variantId: p.variants[0].id,
      });
    }
  }

  return {
    baseUrl,
    auth,
    items,
    branchId: auth.branchId || 'a1111111-1111-1111-1111-111111111111',
    warehouseId: 'b1111111-1111-1111-1111-111111111111',
  };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.auth.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Solicitud 1: Consulta de catálogo / verificación previa
  const res1 = http.get(`${data.baseUrl}/inventory/products`, {
    headers,
    tags: { name: 'GetProducts' },
  });
  check(res1, { 'search 200': (r) => r.status === 200 });

  // Selección de producto distribuida para mitigar contención artificial de bloqueos
  const itemIndex = (__VU + __ITER) % data.items.length;
  const item = data.items[itemIndex];

  // Solicitud 2: Ejecución de Checkout POS atómico con Idempotency-Key única
  const idempotencyKey = `k6-chk-${__VU}-${__ITER}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const checkoutPayload = JSON.stringify({
    branchId: data.branchId,
    items: [
      {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: data.warehouseId,
        quantity: 1,
        unitPrice: 3000,
        taxRate: 0.19,
      },
    ],
    payment: {
      method: 'EFECTIVO',
      cashTendered: 5000,
    },
    notes: `k6 load test vu=${__VU} iter=${__ITER}`,
  });

  const res2 = http.post(`${data.baseUrl}/pos/checkout`, checkoutPayload, {
    headers: Object.assign({}, headers, { 'Idempotency-Key': idempotencyKey }),
    tags: { name: 'PostCheckout' },
  });

  check(res2, {
    'checkout 201': (r) => r.status === 201,
    'has invoiceId': (r) => {
      try {
        const body = r.json();
        return body.success === true && body.invoiceId && body.invoiceId.length > 0;
      } catch (_) {
        return false;
      }
    },
  });
}
