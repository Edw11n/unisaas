import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REDIS_CONFIG,
  DEFAULT_TTL_CONFIG,
} from '../src/config.js';
import {
  sessionKey,
  tenantUserSessionsIndexKey,
  tenantIdempotencyKey,
  tokenBlacklistKey,
  refreshTokenKey,
} from '../src/keys.js';

describe('Redis Configuration & Key Namespace Architecture', () => {
  it('genera namespaces canónicos relativos al keyPrefix de UniSaaS', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const userId = 'u1111111-1111-1111-1111-111111111111';
    const sessionId = 's1111111-1111-1111-1111-111111111111';
    const jti = 'jti-jwt-unique-id';
    const idempotencyKey = 'pos-checkout-uuid-abc';

    assert.equal(sessionKey(sessionId), `session:${sessionId}`);
    assert.equal(
      tenantUserSessionsIndexKey(tenantId, userId),
      `tenant:${tenantId}:user:${userId}:sessions`,
    );
    assert.equal(
      tenantIdempotencyKey(tenantId, idempotencyKey),
      `tenant:${tenantId}:idempotency:${idempotencyKey}`,
    );
    assert.equal(tokenBlacklistKey(jti), `blacklist:token:${jti}`);
    assert.equal(refreshTokenKey(jti), `refreshtoken:${jti}`);
  });

  it('valida la estrategia de TTLs delimitada por tipo de clave sin valores arbitrarios', () => {
    // Sesión activa: 24 horas (86400s) para turnos de trabajo
    assert.equal(DEFAULT_TTL_CONFIG.sessionTtlSeconds, 86400);

    // Refresh token: 7 días (604800s)
    assert.equal(DEFAULT_TTL_CONFIG.refreshTokenTtlSeconds, 604800);

    // Blacklist access token: 15 minutos (900s)
    assert.equal(DEFAULT_TTL_CONFIG.accessTokenBlacklistTtlSeconds, 900);

    // Cerrojo de idempotencia temporal: 30 segundos
    assert.equal(DEFAULT_TTL_CONFIG.idempotencyLockTtlSeconds, 30);
  });

  it('valida el exponential backoff no bloqueante de reconexión', () => {
    const strategy = DEFAULT_REDIS_CONFIG.retryStrategy!;
    assert.equal(typeof strategy, 'function');

    // Intentos 1 a 5 con crecimiento lineal acotado
    assert.equal(strategy(1), 100);
    assert.equal(strategy(2), 200);
    assert.equal(strategy(3), 300);
    assert.equal(strategy(5), 500);

    // Tras 5 intentos suspende reintentos continuos para proteger el event loop
    assert.equal(strategy(6), undefined);
  });
});

