import { randomUUID } from 'node:crypto';
import { InvalidUUIDException } from '../exceptions/domain.exception.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ANY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UUID {
  private constructor(private readonly value: string) {}

  static generate(): UUID {
    return new UUID(randomUUID());
  }

  static from(value: string | UUID): UUID {
    if (value instanceof UUID) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new InvalidUUIDException(`El identificador debe ser una cadena: ${value}`);
    }

    const normalized = value.trim().toLowerCase();
    if (!UUID_ANY_REGEX.test(normalized)) {
      throw new InvalidUUIDException(`Formato UUID inválido: ${value}`);
    }

    return new UUID(normalized);
  }

  static isValid(value: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return UUID_ANY_REGEX.test(value.trim().toLowerCase());
  }

  equals(other: UUID): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

