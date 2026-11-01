import { DEFAULT_TTL_CONFIG } from './config.js';
import { wrapRedisError } from './errors.js';
import { refreshTokenKey, tokenBlacklistKey } from './keys.js';
import { RedisClientService } from './redis-client.service.js';

export class TokenBlacklistService {
  constructor(
    private readonly redisService: RedisClientService,
    private readonly defaultBlacklistTtl: number = DEFAULT_TTL_CONFIG.accessTokenBlacklistTtlSeconds,
    private readonly defaultRefreshTtl: number = DEFAULT_TTL_CONFIG.refreshTokenTtlSeconds,
  ) {}

  /**
   * Registra un token de acceso (JWT jti) en la lista de revocación (blacklist)
   * por el tiempo de vida remanente del token.
   */
  async blacklistToken(jti: string, remainingTtlSeconds?: number): Promise<void> {
    const ttlSeconds = remainingTtlSeconds && remainingTtlSeconds > 0 ? remainingTtlSeconds : this.defaultBlacklistTtl;
    const key = tokenBlacklistKey(jti);
    const timestamp = Date.now().toString();

    try {
      await this.redisService.set(key, timestamp, ttlSeconds);
    } catch (err) {
      wrapRedisError(err, `blacklistToken(${jti})`);
    }
  }

  /**
   * Comprueba si un jti de token de acceso está en la lista negra.
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const key = tokenBlacklistKey(jti);
    try {
      const exists = await this.redisService.exists(key);
      return exists === 1;
    } catch (err) {
      wrapRedisError(err, `isTokenBlacklisted(${jti})`);
    }
  }

  /**
   * Registra un refresh token activo.
   */
  async saveRefreshToken(
    jti: string,
    metadata: { userId: string; tenantId: string },
    customTtlSeconds?: number,
  ): Promise<void> {
    const ttlSeconds = customTtlSeconds && customTtlSeconds > 0 ? customTtlSeconds : this.defaultRefreshTtl;
    const key = refreshTokenKey(jti);

    try {
      await this.redisService.set(key, JSON.stringify(metadata), ttlSeconds);
    } catch (err) {
      wrapRedisError(err, `saveRefreshToken(${jti})`);
    }
  }

  /**
   * Comprueba si un refresh token sigue activo en Redis.
   */
  async isRefreshTokenValid(jti: string): Promise<boolean> {
    const key = refreshTokenKey(jti);
    try {
      const exists = await this.redisService.exists(key);
      return exists === 1;
    } catch (err) {
      wrapRedisError(err, `isRefreshTokenValid(${jti})`);
    }
  }

  /**
   * Revoca un refresh token específico.
   */
  async revokeRefreshToken(jti: string): Promise<boolean> {
    const key = refreshTokenKey(jti);
    try {
      const deleted = await this.redisService.del(key);
      return deleted === 1;
    } catch (err) {
      wrapRedisError(err, `revokeRefreshToken(${jti})`);
    }
  }
}

