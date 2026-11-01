/**
 * Constructores de claves Redis para UniSaaS.
 *
 * NOTA: Dado que el cliente ioredis se inicializa con `keyPrefix: 'unisaas:'`,
 * los métodos aquí devuelven la ruta relativa al namespace base.
 *
 * Estructura Resultante en el Servidor Redis:
 * - unisaas:session:<sessionId>
 * - unisaas:tenant:<tenantId>:user:<userId>:sessions
 * - unisaas:tenant:<tenantId>:idempotency:<key>
 * - unisaas:blacklist:token:<jti>
 * - unisaas:refreshtoken:<jti>
 */

export function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

export function tenantUserSessionsIndexKey(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}:sessions`;
}

export function tenantIdempotencyKey(tenantId: string, key: string): string {
  return `tenant:${tenantId}:idempotency:${key}`;
}

export function tokenBlacklistKey(jti: string): string {
  return `blacklist:token:${jti}`;
}

export function refreshTokenKey(jti: string): string {
  return `refreshtoken:${jti}`;
}

