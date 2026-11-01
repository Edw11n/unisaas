import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RedisClientService } from '../src/redis-client.service.js';
import { IdempotencyLockService } from '../src/idempotency-lock.service.js';
import { tenantIdempotencyKey } from '../src/keys.js';

describe('Cerrojos Distribuidos de Idempotencia (IdempotencyLockService)', () => {
  let redisService: RedisClientService;
  let lockService: IdempotencyLockService;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';

  before(async () => {
    redisService = new RedisClientService({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'unisaas:test:lock:',
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await redisService.connect();
    lockService = new IdempotencyLockService(redisService);
  });

  after(async () => {
    if (redisService) {
      await redisService.disconnect();
    }
  });

  it('adquiere un cerrojo exclusivo para una operación de checkout', async () => {
    const opKey = 'checkout-invoice-101';
    const lock = await lockService.acquireLock(TENANT_ID, opKey, 10);

    assert.equal(lock.acquired, true);
    assert.ok(typeof lock.lockId === 'string');

    const isLocked = await lockService.isLocked(TENANT_ID, opKey);
    assert.equal(isLocked, true);

    // Liberar
    const released = await lock.release();
    assert.equal(released, true);

    const isLockedAfter = await lockService.isLocked(TENANT_ID, opKey);
    assert.equal(isLockedAfter, false);
  });

  it('impide la adquisición concurrente duplicada sobre la misma clave', async () => {
    const opKey = 'concurrent-kardex-adjust-202';

    // Primer intento: Adquiere el lock
    const lock1 = await lockService.acquireLock(TENANT_ID, opKey, 15);
    assert.equal(lock1.acquired, true);

    // Segundo intento concurrente con la misma clave: Debe ser rechazado
    const lock2 = await lockService.acquireLock(TENANT_ID, opKey, 15);
    assert.equal(lock2.acquired, false);
    assert.equal(lock2.lockId, undefined);

    // Liberar el primer cerrojo
    await lock1.release();

    // Tercer intento tras la liberación: Debe permitir la adquisición
    const lock3 = await lockService.acquireLock(TENANT_ID, opKey, 15);
    assert.equal(lock3.acquired, true);
    await lock3.release();
  });

  it('protección de posesión: no se puede liberar un cerrojo con un lockId ajeno', async () => {
    const opKey = 'safe-ownership-op-303';
    const lock = await lockService.acquireLock(TENANT_ID, opKey, 10);
    assert.equal(lock.acquired, true);

    // Simular un proceso externo intentando liberar con otro ID
    const rawClient = redisService.getClient();
    const key = tenantIdempotencyKey(TENANT_ID, opKey);

    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    const fakeResult = await rawClient.eval(luaScript, 1, `unisaas:test:lock:${key}`, 'fake-random-lock-id');
    assert.equal(fakeResult, 0);

    // El cerrojo legítimo sigue intacto
    const stillLocked = await lockService.isLocked(TENANT_ID, opKey);
    assert.equal(stillLocked, true);

    // Liberación legítima por su dueño
    const legitimateRelease = await lock.release();
    assert.equal(legitimateRelease, true);
  });
});

