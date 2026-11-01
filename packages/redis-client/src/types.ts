export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  retryStrategy?: (times: number) => number | void;
}

export interface TtlConfig {
  /** TTL de sesiones activas en segundos (por defecto 86400s = 24 horas) */
  sessionTtlSeconds: number;
  /** TTL de refresh tokens en segundos (por defecto 604800s = 7 días) */
  refreshTokenTtlSeconds: number;
  /** TTL de blacklist de tokens de acceso revocados en segundos (por defecto 900s = 15 minutos) */
  accessTokenBlacklistTtlSeconds: number;
  /** TTL de cerrojo de idempotencia temporal en segundos (por defecto 30 segundos) */
  idempotencyLockTtlSeconds: number;
}

export interface UserSessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface IdempotencyLockResult {
  acquired: boolean;
  lockId?: string;
  release: () => Promise<boolean>;
}

