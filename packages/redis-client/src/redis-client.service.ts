import { Redis } from 'ioredis';
import { DEFAULT_REDIS_CONFIG } from './config.js';
import { wrapRedisError } from './errors.js';
import type { RedisConfig } from './types.js';

export class RedisClientService {
  private client: Redis;
  private isConnected = false;

  constructor(customConfig?: Partial<RedisConfig>) {
    const config: RedisConfig = {
      ...DEFAULT_REDIS_CONFIG,
      ...customConfig,
    };

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      enableReadyCheck: config.enableReadyCheck,
      lazyConnect: config.lazyConnect,
      retryStrategy: config.retryStrategy,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.on('error', (_err) => {
      // Registrar internamente; ioredis emite 'error' en caídas de red
      // para evitar que Node.js lance un unhandledException.
      this.isConnected = false;
    });
  }

  /**
   * Conecta explícitamente el cliente si se inicializó con lazyConnect: true.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      wrapRedisError(err, 'connect');
    }
  }

  /**
   * Cierre ordenado de conexiones.
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client.status !== 'end') {
        await this.client.quit();
      }
      this.isConnected = false;
    } catch {
      this.client.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Comprueba la salud del servicio Redis mediante un PING con timeout.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Retorna la instancia nativa subyacente de ioredis.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Obtiene una clave de texto.
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      wrapRedisError(err, `get(${key})`);
    }
  }

  /**
   * Establece un valor con expiración opcional en segundos.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        return await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return await this.client.set(key, value);
    } catch (err) {
      wrapRedisError(err, `set(${key})`);
    }
  }

  /**
   * Elimina una clave.
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (err) {
      wrapRedisError(err, `del(${key})`);
    }
  }

  /**
   * Verifica la existencia de una clave.
   */
  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (err) {
      wrapRedisError(err, `exists(${key})`);
    }
  }

  /**
   * Asigna un tiempo de expiración a una clave existente.
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (err) {
      wrapRedisError(err, `expire(${key})`);
    }
  }

  /**
   * Ejecuta un script Lua directamente sobre Redis.
   */
  async eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown> {
    try {
      return await this.client.eval(script, numkeys, ...args);
    } catch (err) {
      wrapRedisError(err, 'eval');
    }
  }
}

