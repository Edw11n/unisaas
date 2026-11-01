import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RedisClientService } from '../src/redis-client.service.js';
import { TokenBlacklistService } from '../src/token-blacklist.service.js';

describe('Lista Negra de Tokens y Refresh Tokens (TokenBlacklistService)', () => {
  let redisService: RedisClientService;
  let blacklistService: TokenBlacklistService;

  before(async () => {
    redisService = new RedisClientService({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'unisaas:test:tok:',
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await redisService.connect();
    blacklistService = new TokenBlacklistService(redisService);
  });

  after(async () => {
    if (redisService) {
      await redisService.disconnect();
    }
  });

  it('añade un jti a la lista negra y comprueba su estado', async () => {
    const jti = `access-jwt-jti-${randomUUID()}`;

    assert.equal(await blacklistService.isTokenBlacklisted(jti), false);

    await blacklistService.blacklistToken(jti, 60);

    assert.equal(await blacklistService.isTokenBlacklisted(jti), true);
  });

  it('gestiona el ciclo de vida de refresh tokens (guardar, validar y revocar)', async () => {
    const refreshJti = `refresh-jti-${randomUUID()}`;
    const metadata = {
      userId: 'u1111111-1111-1111-1111-111111111111',
      tenantId: '11111111-1111-1111-1111-111111111111',
    };

    assert.equal(await blacklistService.isRefreshTokenValid(refreshJti), false);

    await blacklistService.saveRefreshToken(refreshJti, metadata, 120);
    assert.equal(await blacklistService.isRefreshTokenValid(refreshJti), true);

    const revoked = await blacklistService.revokeRefreshToken(refreshJti);
    assert.equal(revoked, true);
    assert.equal(await blacklistService.isRefreshTokenValid(refreshJti), false);
  });
});

