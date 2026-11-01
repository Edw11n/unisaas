import type { RedisConfig, TtlConfig } from './types.js';

export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'unisaas:',
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times: number) {
    if (times > 5) {
      // Dejar de reintentar tras 5 intentos continuos para no saturar el event loop
      return undefined;
    }
    // Exponential backoff no bloqueante: 100ms, 200ms, 400ms, 800ms, 1600ms
    return Math.min(times * 100, 2000);
  },
};

export const DEFAULT_TTL_CONFIG: TtlConfig = {
  /**
   * TTL de sesiones activas:
   * 86400 segundos (24 horas). Permite mantener sesiones durante la jornada laboral
   * de cajeros y contadores sin requerir logins continuos.
   */
  sessionTtlSeconds: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),

  /**
   * TTL de refresh tokens:
   * 604800 segundos (7 días). Límite máximo de vida de la rotación de tokens.
   */
  refreshTokenTtlSeconds: parseInt(process.env.REDIS_REFRESH_TOKEN_TTL || '604800', 10),

  /**
   * TTL de tokens de acceso revocados (blacklist):
   * 900 segundos (15 minutos). Equivalente a la ventana de expiración del JWT de acceso.
   */
  accessTokenBlacklistTtlSeconds: parseInt(process.env.REDIS_ACCESS_BLACKLIST_TTL || '900', 10),

  /**
   * TTL de cerrojos de idempotencia temporal:
   * 30 segundos. Ventana suficiente para procesar facturación o checkout POS y descartar reintentos en vuelo.
   */
  idempotencyLockTtlSeconds: parseInt(process.env.REDIS_IDEMPOTENCY_LOCK_TTL || '30', 10),
};

