import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UUID } from '../src/value-objects/uuid.vo.js';
import { InvalidUUIDException } from '../src/exceptions/domain.exception.js';

describe('UUID Value Object', () => {
  it('genera identificadores UUID v4 válidos', () => {
    const id = UUID.generate();
    assert.equal(UUID.isValid(id.toString()), true);
  });

  it('instancia UUIDs válidos desde cadenas normalizadas', () => {
    const raw = 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11';
    const id = UUID.from(raw);
    assert.equal(id.toString(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('rechaza cadenas que no cumplan el formato UUID', () => {
    assert.throws(() => UUID.from('12345'), InvalidUUIDException);
    assert.throws(() => UUID.from('no-es-un-uuid'), InvalidUUIDException);
    assert.throws(() => UUID.from(''), InvalidUUIDException);
  });

  it('compara igualdad por valor', () => {
    const id1 = UUID.from('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    const id2 = UUID.from('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11');
    const id3 = UUID.generate();

    assert.equal(id1.equals(id2), true);
    assert.equal(id1.equals(id3), false);
  });
});

