import { DEFAULT_TTL_CONFIG } from './config.js';
import { wrapRedisError } from './errors.js';
import { sessionKey, tenantUserSessionsIndexKey } from './keys.js';
import { RedisClientService } from './redis-client.service.js';
import type { UserSessionData } from './types.js';

export class SessionCacheService {
  constructor(
    private readonly redisService: RedisClientService,
    private readonly defaultSessionTtl: number = DEFAULT_TTL_CONFIG.sessionTtlSeconds,
  ) {}

  /**
   * Guarda o renueva una sesión en Redis de forma atómica, registrándola
   * simultáneamente en el índice secundario ZSET del usuario para permitir
   * revocaciones instantáneas y consultas ordenadas por expiración.
   *
   * Salvaguarda de Concurrencia (Regla 4):
   * La operación se realiza de forma atómica. La purga concurrente solo elimina
   * miembros con expiración estrictamente anterior al timestamp actual, protegiendo
   * sesiones que acaban de crearse o renovarse.
   */
  async saveSession(session: UserSessionData, customTtlSeconds?: number): Promise<void> {
    const ttlSeconds = customTtlSeconds && customTtlSeconds > 0 ? customTtlSeconds : this.defaultSessionTtl;
    const now = Date.now();
    const expiresAt = session.expiresAt || (now + ttlSeconds * 1000);

    const sKey = sessionKey(session.sessionId);
    const zKey = tenantUserSessionsIndexKey(session.tenantId, session.userId);

    const payload = JSON.stringify({
      ...session,
      expiresAt,
    });

    // Lua script atómico para guardar sesión, actualizar ZSET y refrescar TTL del índice
    const luaScript = `
      local sKey = KEYS[1]
      local zKey = KEYS[2]
      local payload = ARGV[1]
      local ttl = tonumber(ARGV[2])
      local score = tonumber(ARGV[3])
      local member = ARGV[4]
      local now = tonumber(ARGV[5])

      -- 1. Guardar payload de la sesión con expiración TTL
      redis.call('SET', sKey, payload, 'EX', ttl)

      -- 2. Registrar o actualizar miembro en el índice ZSET con score = timestamp Unix
      redis.call('ZADD', zKey, score, member)

      -- 3. Asignar TTL al índice para evitar claves huérfanas en desuso (TTL sesión + 1 día de gracia)
      redis.call('EXPIRE', zKey, ttl + 86400)

      -- 4. Purgar de forma segura miembros expirados anteriores a 'now'
      redis.call('ZREMRANGEBYSCORE', zKey, '-inf', '(' .. now)

      return 1
    `;

    try {
      await this.redisService.eval(
        luaScript,
        2,
        sKey,
        zKey,
        payload,
        ttlSeconds,
        expiresAt,
        session.sessionId,
        now,
      );
    } catch (err) {
      wrapRedisError(err, `saveSession(${session.sessionId})`);
    }
  }

  /**
   * Obtiene la sesión por su ID único (jti / sessionId).
   */
  async getSession(sessionId: string): Promise<UserSessionData | null> {
    try {
      const sKey = sessionKey(sessionId);
      const raw = await this.redisService.get(sKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as UserSessionData;
    } catch (err) {
      wrapRedisError(err, `getSession(${sessionId})`);
    }
  }

  /**
   * Renueva el tiempo de vida (touch) de una sesión activa.
   */
  async touchSession(
    tenantId: string,
    userId: string,
    sessionId: string,
    extendTtlSeconds?: number,
  ): Promise<boolean> {
    const ttlSeconds = extendTtlSeconds || this.defaultSessionTtl;
    const now = Date.now();
    const newExpiresAt = now + ttlSeconds * 1000;

    const sKey = sessionKey(sessionId);
    const zKey = tenantUserSessionsIndexKey(tenantId, userId);

    const luaScript = `
      local sKey = KEYS[1]
      local zKey = KEYS[2]
      local ttl = tonumber(ARGV[1])
      local newScore = tonumber(ARGV[2])
      local member = ARGV[3]

      local raw = redis.call('GET', sKey)
      if not raw then
        return 0
      end

      -- Actualizar TTL en la clave de datos
      redis.call('EXPIRE', sKey, ttl)

      -- Actualizar score en el índice ZSET
      redis.call('ZADD', zKey, newScore, member)
      redis.call('EXPIRE', zKey, ttl + 86400)

      return 1
    `;

    try {
      const result = await this.redisService.eval(
        luaScript,
        2,
        sKey,
        zKey,
        ttlSeconds,
        newExpiresAt,
        sessionId,
      );
      return result === 1;
    } catch (err) {
      wrapRedisError(err, `touchSession(${sessionId})`);
    }
  }

  /**
   * Lista todas las sesiones activas de un usuario en un inquilino,
   * purgando de forma limpia cualquier entrada expirada sin invocar SCAN.
   */
  async getUserSessions(tenantId: string, userId: string): Promise<UserSessionData[]> {
    const zKey = tenantUserSessionsIndexKey(tenantId, userId);
    const now = Date.now();

    try {
      const client = this.redisService.getClient();

      // 1. Purgar miembros del ZSET cuyo score sea menor que now
      await client.zremrangebyscore(zKey, '-inf', `(${now}`);

      // 2. Obtener los identificadores de sesión candidatos
      const sessionIds = await client.zrange(zKey, 0, -1);
      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }

      // 3. Obtener concurrentemente los datos de cada sesión mediante pipeline
      const pipeline = client.pipeline();
      for (const sid of sessionIds) {
        pipeline.get(sessionKey(sid));
      }
      const results = await pipeline.exec();

      const activeSessions: UserSessionData[] = [];
      const staleSessionIds: string[] = [];

      if (results) {
        for (let i = 0; i < results.length; i++) {
          const [err, raw] = results[i];
          const sid = sessionIds[i];

          if (!err && raw && typeof raw === 'string') {
            try {
              activeSessions.push(JSON.parse(raw) as UserSessionData);
            } catch {
              staleSessionIds.push(sid);
            }
          } else {
            // La clave de sesión ya expiró o no existe en Redis
            staleSessionIds.push(sid);
          }
        }
      }

      // 4. Limpieza perezosa: remover del ZSET aquellas claves que expiraron en Redis
      if (staleSessionIds.length > 0) {
        await client.zrem(zKey, ...staleSessionIds);
      }

      return activeSessions;
    } catch (err) {
      wrapRedisError(err, `getUserSessions(${tenantId}, ${userId})`);
    }
  }

  /**
   * Revoca una sesión específica eliminando su clave y su referencia en el ZSET.
   */
  async revokeSession(tenantId: string, userId: string, sessionId: string): Promise<boolean> {
    const sKey = sessionKey(sessionId);
    const zKey = tenantUserSessionsIndexKey(tenantId, userId);

    const luaScript = `
      local sKey = KEYS[1]
      local zKey = KEYS[2]
      local member = ARGV[1]

      redis.call('DEL', sKey)
      local removed = redis.call('ZREM', zKey, member)
      return removed
    `;

    try {
      const removed = await this.redisService.eval(luaScript, 2, sKey, zKey, sessionId);
      return Number(removed) > 0;
    } catch (err) {
      wrapRedisError(err, `revokeSession(${sessionId})`);
    }
  }

  /**
   * Revoca masivamente todas las sesiones activas de un usuario en un inquilino
   * en tiempo O(M) atómico sin escanear el espacio de claves de Redis (cero KEYS *).
   */
  async revokeAllUserSessions(tenantId: string, userId: string): Promise<number> {
    const zKey = tenantUserSessionsIndexKey(tenantId, userId);
    const client = this.redisService.getClient();
    const keyPrefix = client.options.keyPrefix || '';
    const sessionPrefix = `${keyPrefix}session:`;

    // Script Lua para revocar todas las sesiones del ZSET en tiempo O(M)
    const luaScript = `
      local zKey = KEYS[1]
      local sessionPrefix = ARGV[1]
      local sessionIds = redis.call('ZRANGE', zKey, 0, -1)
      local count = #sessionIds

      if count > 0 then
        for i = 1, count do
          local sid = sessionIds[i]
          redis.call('DEL', sessionPrefix .. sid)
        end
      end

      -- Eliminar el índice secundario ZSET
      redis.call('DEL', zKey)
      return count
    `;

    try {
      const revokedCount = await this.redisService.eval(luaScript, 1, zKey, sessionPrefix);
      return Number(revokedCount) || 0;
    } catch (err) {
      wrapRedisError(err, `revokeAllUserSessions(${tenantId}, ${userId})`);
    }
  }
}
