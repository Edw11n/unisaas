import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from '../src/controllers/health.controller.js';

describe('API Gateway - Sonda de Salud e Infraestructura (@unisaas/api-gateway)', () => {
  it('HealthController reporta estado "ok" cuando PostgreSQL y Redis están saludables', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    } as any;

    const mockRedis = {
      isHealthy: async () => true,
    } as any;

    const controller = new HealthController(mockPrisma, mockRedis);
    const result = await controller.checkHealth();

    assert.equal(result.status, 'ok');
    assert.equal(result.services.database, 'healthy');
    assert.equal(result.services.redis, 'healthy');
    assert.ok(result.timestamp);
  });

  it('HealthController reporta estado "degraded" si Redis falla pero PostgreSQL sigue en línea', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    } as any;

    const mockRedis = {
      isHealthy: async () => {
        throw new Error('Redis connection timed out');
      },
    } as any;

    const controller = new HealthController(mockPrisma, mockRedis);
    const result = await controller.checkHealth();

    assert.equal(result.status, 'degraded');
    assert.equal(result.services.database, 'healthy');
    assert.equal(result.services.redis, 'unhealthy');
  });

  it('HealthController reporta estado "down" si PostgreSQL está inaccesible', async () => {
    const mockPrisma = {
      $queryRaw: async () => {
        throw new Error('DB connection refused');
      },
    } as any;

    const mockRedis = {
      isHealthy: async () => true,
    } as any;

    const controller = new HealthController(mockPrisma, mockRedis);
    const result = await controller.checkHealth();

    assert.equal(result.status, 'down');
    assert.equal(result.services.database, 'unhealthy');
  });
});

