import http from 'k6/http';
import { check } from 'k6';

export function getAuthToken(baseUrl, email, password) {
  const url = `${baseUrl}/auth/login`;
  const payload = JSON.stringify({ email: email, password: password });
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'login status is 200': (r) => r.status === 200,
    'has accessToken': (r) => {
      try {
        const json = r.json();
        return json.accessToken && json.accessToken.length > 0;
      } catch (_) {
        return false;
      }
    },
  });

  const body = res.json();
  return {
    token: body.accessToken,
    tenantId: body.user ? body.user.tenantId : '',
    branchId: body.user ? body.user.branchId : '',
  };
}

