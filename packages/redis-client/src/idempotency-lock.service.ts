import { randomUUID } from 'node:crypto';
import { DEFAULT_TTL_CONFIG } from './config.js';
import { wrapRedisError } from './errors.js';
import { tenantIdempotencyKey } from './keys.js';
import { RedisClientService } from './redis-client.service.js';
import type { IdempotencyLockResult } from './types.js';

export class IdempotencyLockService {
  constructor(
    private readonly redisService: RedisClientService,
    private readonly defaultLockTtl: number = DEFAULT_TTL_CONFIG.idempotencyLockTtlSeconds,
  ) {}

  /**
   * Intenta adquirir un cerrojo distribuido de corta duración para una operación crítica (ej. checkout POS).
   *
   * Garantías:
   * 1. Exclusión Mutua Atómica (SET NX EX).
   * 2. Liberación Segura con Token de Posesión: Solo quien adquirió el lockId puede liberarlo (evita carreras si expira).
   * 3. Liberación Atómica mediante script Lua.
   */
  async acquireLock(
    tenantId: string,
    operationKey: string,
    customTtlSeconds?: number,
  ): Promise<IdempotencyLockResult> {
    const ttlSeconds = customTtlSeconds && customTtlSeconds > 0 ? customTtlSeconds : this.defaultLockTtl;
    const lockId = randomUUID();
    const key = tenantIdempotencyKey(tenantId, operationKey);

    try {
      const client = this.redisService.getClient();
      const res = await client.set(key, lockId, 'EX', ttlSeconds, 'NX');
      const acquired = res === 'OK';

      if (!acquired) {
        return {
          acquired: false,
          release: async () => false,
        };
      }

      return {
        acquired: true,
        lockId,
        release: async () => {
          return this.releaseLock(key, lockId);
        },
      };
    } catch (err) {
      wrapRedisError(err, `acquireLock(${tenantId}, ${operationKey})`);
    }
  }

  /**
   * Libera de forma atómica el cerrojo verificando que el valor coincida con el lockId poseído.
   */
  private async releaseLock(key: string, lockId: string): Promise<boolean> {
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redisService.eval(luaScript, 1, key, lockId);
      return Number(result) === 1;
    } catch (err) {
      wrapRedisError(err, `releaseLock(${key})`);
    }
  }

  /**
   * Comprueba si una operación se encuentra actualmente bloqueada.
   */
  async isLocked(tenantId: string, operationKey: string): Promise<boolean> {
    const key = tenantIdempotencyKey(tenantId, operationKey);
    try {
      const exists = await this.redisService.exists(key);
      return exists === 1;
    } catch (err) {
      wrapRedisError(err, `isLocked(${tenantId}, ${operationKey})`);
    }
  }
}

