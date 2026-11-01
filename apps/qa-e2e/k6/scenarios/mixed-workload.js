import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getAuthToken } from '../helpers/auth.js';

// Métricas personalizadas obligatorias
const searchDuration = new Trend('search_req_duration', true);
const checkoutDuration = new Trend('checkout_req_duration', true);
const checkoutErrors = new Rate('checkout_failure_rate');
const httpRequestsTotal = new Counter('http_requests_total_custom');

export const options = {
  scenarios: {
    mixed_open_workload: {
      executor: 'constant-arrival-rate',
      rate: 40, // 40 iteraciones/segundo
      timeUnit: '1s',
      duration: __ENV.TEST_DURATION || '15m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    // Latencia p95 global menor o igual a 350 ms
    http_req_duration: ['p(95)<=350'],
    // Tasa global de fallos HTTP
    http_req_failed: ['rate<0.01'],
    // Errores de checkout estrictamente menores a 0.1%
    checkout_failure_rate: ['rate<0.001'],
  },
};

export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
  const auth = getAuthToken(
    baseUrl,
    __ENV.AUTH_EMAIL || 'cajero@tenant-1111.com',
    __ENV.AUTH_PASSWORD || 'password123',
  );

  // Precargar catálogo de productos para distribuir ventas entre múltiples SKUs
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

  // Modelo ponderado de carga abierta:
  // 75% Búsqueda de productos (1 solicitud HTTP)
  // 25% Checkout POS (2 solicitudes HTTP: consulta + checkout)
  // Promedio ponderado: 0.75 * 1 + 0.25 * 2 = 1.25 solicitudes HTTP/iteración
  // 40 iteraciones/s * 1.25 = 50 solicitudes HTTP/s objetivo

  const roll = Math.random();

  if (roll < 0.75) {
    // --- Operación 1: Búsqueda de productos (1 HTTP Request) ---
    httpRequestsTotal.add(1);
    const start = Date.now();
    const res = http.get(`${data.baseUrl}/inventory/products`, {
      headers,
      tags: { name: 'GetProducts' },
    });
    searchDuration.add(Date.now() - start);

    check(res, {
      'search status 200': (r) => r.status === 200,
      'has products array': (r) => {
        try {
          return Array.isArray(r.json());
        } catch (_) {
          return false;
        }
      },
    });
  } else {
    // --- Operación 2: Checkout POS (2 HTTP Requests) ---
    // Solicitud 2.1: Consulta previa de producto
    httpRequestsTotal.add(1);
    const startSearch = Date.now();
    const resProd = http.get(`${data.baseUrl}/inventory/products`, {
      headers,
      tags: { name: 'GetProducts_PreCheckout' },
    });
    searchDuration.add(Date.now() - startSearch);
    check(resProd, { 'precheckout search 200': (r) => r.status === 200 });

    // Selección de producto distribuida para mitigar contención artificial de bloqueos
    const itemIndex = (__VU + __ITER) % data.items.length;
    const item = data.items[itemIndex];

    // Solicitud 2.2: Checkout atómico con Idempotency-Key única
    httpRequestsTotal.add(1);
    const idempotencyKey = `k6-mix-${__VU}-${__ITER}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
      notes: `k6 mixed load vu=${__VU} iter=${__ITER}`,
    });

    const startCheckout = Date.now();
    const resCheckout = http.post(`${data.baseUrl}/pos/checkout`, checkoutPayload, {
      headers: Object.assign({}, headers, { 'Idempotency-Key': idempotencyKey }),
      tags: { name: 'PostCheckout' },
    });
    checkoutDuration.add(Date.now() - startCheckout);

    const isSuccess = check(resCheckout, {
      'checkout status 201': (r) => r.status === 201,
      'checkout success flag': (r) => {
        try {
          const body = r.json();
          return body.success === true && body.invoiceId !== undefined;
        } catch (_) {
          return false;
        }
      },
    });

    if (!isSuccess) {
      checkoutErrors.add(1);
    } else {
      checkoutErrors.add(0);
    }
  }
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || 'apps/qa-e2e/reports/k6-mixed-summary.json';
  const out = {};
  out[summaryPath] = JSON.stringify(data, null, 2);
  out['stdout'] = textSummary(data);
  return out;
}

function textSummary(data) {
  const m = data.metrics;
  const httpReqs = m.http_reqs ? m.http_reqs.values.count : 0;
  const httpRate = m.http_reqs ? m.http_reqs.values.rate : 0;
  const iters = m.iterations ? m.iterations.values.count : 0;
  const iterRate = m.iterations ? m.iterations.values.rate : 0;
  const p95 = m.http_req_duration ? m.http_req_duration.values['p(95)'] : 0;
  const p90 = m.http_req_duration ? m.http_req_duration.values['p(90)'] : 0;
  const p50 = m.http_req_duration ? m.http_req_duration.values['med'] : 0;
  const failedRate = m.http_req_failed ? m.http_req_failed.values.rate : 0;
  const droppedIters = m.dropped_iterations ? m.dropped_iterations.values.count : 0;
  const chkErrRate = m.checkout_failure_rate ? m.checkout_failure_rate.values.rate : 0;

  return `
================================================================================
REPORTE RESUMIDO k6 - MODELO DE CARGA ABIERTA (constant-arrival-rate)
================================================================================
Throughput de Iteraciones:     ${iterRate.toFixed(2)} iter/s (Total: ${iters})
Throughput Solicitudes HTTP:   ${httpRate.toFixed(2)} req/s  (Total: ${httpReqs})
Relación Solicitudes/Iteración: ${(iters > 0 ? (httpReqs / iters).toFixed(2) : '0')} HTTP req/iter (Objetivo: 1.25)
Dropped Iterations:            ${droppedIters}
Latencia p50 (mediana):        ${p50.toFixed(2)} ms
Latencia p90:                  ${p90.toFixed(2)} ms
Latencia p95:                  ${p95.toFixed(2)} ms (Objetivo: <= 350 ms)
Tasa Global Errores HTTP:      ${(failedRate * 100).toFixed(3)}%
Tasa de Fallos en Checkout:    ${(chkErrRate * 100).toFixed(3)}% (Objetivo: < 0.1%)
================================================================================
`;
}
