import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTransportError,
  wrapRedisError,
  RedisUnavailableException,
  RedisException,
} from '../src/errors.js';
import { RedisClientService } from '../src/redis-client.service.js';

describe('Manejo de Errores de Transporte y Resiliencia ante Caídas de Redis', () => {
  it('identifica correctamente códigos y mensajes de error de transporte de red', () => {
    assert.equal(isTransportError({ code: 'ECONNREFUSED' }), true);
    assert.equal(isTransportError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isTransportError({ code: 'ENOTFOUND' }), true);
    assert.equal(isTransportError({ code: 'NR_CLOSED' }), true);
    assert.equal(isTransportError({ message: 'Connection is closed.' }), true);
    assert.equal(isTransportError({ message: 'Stream isn\'t writeable and enableOfflineQueue options = false' }), true);

    // Errores de sintaxis o lógica no son de transporte
    assert.equal(isTransportError({ message: 'ERR unknown command' }), false);
    assert.equal(isTransportError(null), false);
    assert.equal(isTransportError('string error'), false);
  });

  it('traduce errores de transporte a RedisUnavailableException (HTTP 503 / Retry-After: 5)', () => {
    try {
      wrapRedisError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:6379' }, 'get(user_session)');
      assert.fail('Debió lanzar una excepción');
    } catch (err: unknown) {
      assert.ok(err instanceof RedisUnavailableException);
      assert.equal((err as RedisUnavailableException).status, 503);
      assert.equal((err as RedisUnavailableException).retryAfter, 5);
      assert.ok((err as RedisUnavailableException).message.includes('Fallo de transporte'));

      // Innegociable: NO debe ser 401
      assert.notEqual((err as RedisUnavailableException).status, 401);
    }
  });

  it('preserva excepciones que no son de transporte como RedisException genérica (500)', () => {
    try {
      wrapRedisError(new Error('WRONGTYPE Operation against a key holding the wrong kind of value'), 'set');
      assert.fail('Debió lanzar una excepción');
    } catch (err: unknown) {
      assert.ok(err instanceof RedisException);
      assert.equal((err as RedisException).status, 500);
      assert.ok(!(err instanceof RedisUnavailableException));
    }
  });

  it('simula caída o servidor Redis inalcanzable: lanza RedisUnavailableException en operaciones', async () => {
    // Configurar cliente apuntando a un puerto inalcanzable
    const deadClient = new RedisClientService({
      port: 6398, // Puerto sin servidor
      connectTimeout: 500,
      commandTimeout: 500,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => undefined,
    });

    try {
      // Intentar conectar al puerto inalcanzable
      await deadClient.connect();
      assert.fail('La conexión debió fallar por puerto inalcanzable');
    } catch (err: unknown) {
      assert.ok(err instanceof RedisUnavailableException);
      assert.equal((err as RedisUnavailableException).status, 503);
      assert.equal((err as RedisUnavailableException).retryAfter, 5);
    } finally {
      await deadClient.disconnect();
    }
  });
});

