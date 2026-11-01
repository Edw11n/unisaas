import http from 'k6/http';
import { check } from 'k6';
import { getAuthToken } from '../helpers/auth.js';

export const options = {
  scenarios: {
    product_search_constant: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: __ENV.TEST_DURATION || '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<=350'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const baseUrl = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
  const auth = getAuthToken(
    baseUrl,
    __ENV.AUTH_EMAIL || 'cajero@tenant-1111.com',
    __ENV.AUTH_PASSWORD || 'password123',
  );
  return { baseUrl, auth };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.auth.token}`,
      Accept: 'application/json',
    },
    tags: { name: 'GetProducts' },
  };

  const res = http.get(`${data.baseUrl}/inventory/products`, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has products': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body) && body.length > 0;
      } catch (_) {
        return false;
      }
    },
  });
}

