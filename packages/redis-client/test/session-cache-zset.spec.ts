import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RedisClientService } from '../src/redis-client.service.js';
import { SessionCacheService } from '../src/session-cache.service.js';
import { tenantUserSessionsIndexKey } from '../src/keys.js';
import type { UserSessionData } from '../src/types.js';

describe('Gestor de Sesiones y Revocación Atómica ZSET (SessionCacheService)', () => {
  let redisService: RedisClientService;
  let sessionCache: SessionCacheService;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = 'u1111111-1111-1111-1111-111111111111';

  before(async () => {
    redisService = new RedisClientService({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'unisaas:test:',
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await redisService.connect();
    sessionCache = new SessionCacheService(redisService);
  });

  after(async () => {
    if (redisService) {
      await redisService.disconnect();
    }
  });

  it('verifica que el servicio Redis se encuentra saludable (isHealthy)', async () => {
    const healthy = await redisService.isHealthy();
    assert.equal(healthy, true);
  });

  it('guarda una sesión y la registra concurrentemente en el índice ZSET', async () => {
    const sessionId = 'sess-001';
    const now = Date.now();
    const session: UserSessionData = {
      sessionId,
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: 'cajero1@unisaas.com',
      roles: ['CASHIER'],
      createdAt: now,
      expiresAt: now + 3600 * 1000,
    };

    await sessionCache.saveSession(session, 3600);

    const retrieved = await sessionCache.getSession(sessionId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.sessionId, sessionId);
    assert.equal(retrieved.email, 'cajero1@unisaas.com');

    // Verificar presencia en ZSET
    const activeSessions = await sessionCache.getUserSessions(TENANT_ID, USER_ID);
    const found = activeSessions.find((s) => s.sessionId === sessionId);
    assert.ok(found !== undefined);
  });

  it('protección frente a carreras: la purga no elimina sesiones recién creadas o renovadas (Regla 4)', async () => {
    const sessionId = 'sess-renewed-002';
    const now = Date.now();
    const session: UserSessionData = {
      sessionId,
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: 'cajero2@unisaas.com',
      roles: ['CASHIER'],
      createdAt: now,
      expiresAt: now + 1800 * 1000, // 30 minutos a futuro
    };

    // 1. Guardar la sesión
    await sessionCache.saveSession(session, 1800);

    // 2. Simular ejecución inmediata de purga con el timestamp actual
    const zKey = tenantUserSessionsIndexKey(TENANT_ID, USER_ID);
    const client = redisService.getClient();
    await client.zremrangebyscore(zKey, '-inf', `(${Date.now()}`);

    // 3. Comprobar que la sesión renovada permanece 100% activa
    const stillActive = await sessionCache.getSession(sessionId);
    assert.ok(stillActive !== null);
    assert.equal(stillActive.sessionId, sessionId);

    const userSessions = await sessionCache.getUserSessions(TENANT_ID, USER_ID);
    const inList = userSessions.find((s) => s.sessionId === sessionId);
    assert.ok(inList !== undefined);
  });

  it('purga limpiamente miembros expirados del ZSET sin invocar SCAN', async () => {
    const zKey = tenantUserSessionsIndexKey(TENANT_ID, USER_ID);
    const client = redisService.getClient();

    // Inyectar manualmente un miembro con score en el pasado (expirado hace 10 segundos)
    const expiredSid = 'sess-stale-past-003';
    const pastTimestamp = Date.now() - 10000;
    await client.zadd(zKey, pastTimestamp, expiredSid);

    // Al consultar getUserSessions, la purga interna debe descartar el miembro vencido
    const sessions = await sessionCache.getUserSessions(TENANT_ID, USER_ID);
    const expiredFound = sessions.find((s) => s.sessionId === expiredSid);
    assert.equal(expiredFound, undefined);

    // El miembro fue removido del ZSET
    const score = await client.zscore(zKey, expiredSid);
    assert.equal(score, null);
  });

  it('touchSession renueva el TTL y actualiza el score en el ZSET', async () => {
    const sessionId = 'sess-touch-004';
    const now = Date.now();
    await sessionCache.saveSession({
      sessionId,
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: 'touch@unisaas.com',
      roles: ['ADMIN'],
      createdAt: now,
      expiresAt: now + 600 * 1000,
    }, 600);

    const renewed = await sessionCache.touchSession(TENANT_ID, USER_ID, sessionId, 7200);
    assert.equal(renewed, true);

    const client = redisService.getClient();
    const ttl = await client.ttl(`session:${sessionId}`);
    assert.ok(ttl > 3600); // Supera ampliamente la 1ra hora
  });

  it('revoca una sesión individual eliminando su clave y su referencia en ZSET', async () => {
    const sessionId = 'sess-revoke-single-005';
    await sessionCache.saveSession({
      sessionId,
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: 'revoke@unisaas.com',
      roles: ['CASHIER'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000,
    }, 3600);

    const revoked = await sessionCache.revokeSession(TENANT_ID, USER_ID, sessionId);
    assert.equal(revoked, true);

    const payload = await sessionCache.getSession(sessionId);
    assert.equal(payload, null);

    const activeList = await sessionCache.getUserSessions(TENANT_ID, USER_ID);
    assert.equal(activeList.find((s) => s.sessionId === sessionId), undefined);
  });

  it('revoca masivamente todas las sesiones de un usuario en tiempo O(M) sin KEYS *', async () => {
    const targetUserId = 'u2222222-2222-2222-2222-222222222222';
    const s1 = 'sess-mass-1';
    const s2 = 'sess-mass-2';
    const s3 = 'sess-mass-3';

    for (const sid of [s1, s2, s3]) {
      await sessionCache.saveSession({
        sessionId: sid,
        userId: targetUserId,
        tenantId: TENANT_ID,
        email: 'mass@unisaas.com',
        roles: ['CASHIER'],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
      }, 3600);
    }

    const initialSessions = await sessionCache.getUserSessions(TENANT_ID, targetUserId);
    assert.equal(initialSessions.length, 3);

    // Revocación masiva atómica
    const count = await sessionCache.revokeAllUserSessions(TENANT_ID, targetUserId);
    assert.equal(count, 3);

    // Todas las sesiones individuales fueron eliminadas
    assert.equal(await sessionCache.getSession(s1), null);
    assert.equal(await sessionCache.getSession(s2), null);
    assert.equal(await sessionCache.getSession(s3), null);

    // El índice ZSET fue eliminado por completo
    const remaining = await sessionCache.getUserSessions(TENANT_ID, targetUserId);
    assert.equal(remaining.length, 0);
  });
});

