export class RedisException extends Error {
  readonly status: number;
  readonly isOperational: boolean;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'RedisException';
    this.status = status;
    this.isOperational = true;
  }
}

/**
 * Excepción lanzada exclusivamente ante fallos de conectividad, red o indisponibilidad
 * del clúster/servidor de Redis (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, NR_CLOSED).
 *
 * Directiva Innegociable:
 * Una caída de infraestructura en Redis se traduce a HTTP 503 (Service Unavailable)
 * con cabecera Retry-After: 5. BAJO NINGUNA CIRCUNSTANCIA debe convertirse en un error
 * 401 Unauthorized, lo cual confundiría a los clientes haciéndoles creer que sus credenciales son inválidas.
 */
export class RedisUnavailableException extends RedisException {
  readonly retryAfter: number;

  constructor(
    message = 'El servicio de estado temporal (Redis) no está disponible en este momento',
    retryAfter = 5,
  ) {
    super(message, 503);
    this.name = 'RedisUnavailableException';
    this.retryAfter = retryAfter;
  }
}

export class RedisLockAcquisitionException extends RedisException {
  constructor(message = 'No fue posible adquirir el cerrojo de idempotencia distribuido') {
    super(message, 409);
    this.name = 'RedisLockAcquisitionException';
  }
}

export class RedisSessionException extends RedisException {
  constructor(message: string) {
    super(message, 500);
    this.name = 'RedisSessionException';
  }
}

/**
 * Comprueba si un error es de transporte o desconexión física de Redis.
 */
export function isTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const e = err as { code?: string; message?: string; name?: string };

  const transportCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'NR_CLOSED',
  ];

  if (e.code && transportCodes.includes(e.code)) {
    return true;
  }

  if (e.message) {
    const msg = e.message.toLowerCase();
    if (
      msg.includes('connection is closed') ||
      msg.includes('stream isn\'t writeable') ||
      msg.includes('enableofflinequeue') ||
      msg.includes('connect econnrefused') ||
      msg.includes('failed to refresh slots cache') ||
      msg.includes('command timed out')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Captura y traduce errores de Redis. Si el error es de conectividad física,
 * lanza de inmediato RedisUnavailableException (HTTP 503) para preservar la resiliencia del sistema.
 */
export function wrapRedisError(err: unknown, operation: string): never {
  if (err instanceof RedisUnavailableException || err instanceof RedisLockAcquisitionException) {
    throw err;
  }

  if (isTransportError(err)) {
    const originalMsg = err instanceof Error ? err.message : String(err);
    throw new RedisUnavailableException(
      `Fallo de transporte en operación Redis "${operation}": ${originalMsg}`,
      5,
    );
  }

  if (err instanceof Error) {
    throw new RedisException(`Error en operación Redis "${operation}": ${err.message}`, 500);
  }

  throw new RedisException(`Error desconocido en operación Redis "${operation}"`, 500);
}

