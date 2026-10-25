import { describe, expect, it } from 'vitest';
import { ownValue } from './ownValue';

describe('ownValue', () => {
  const table = { success: 'ok', failed: 'bad' };

  it('reads a key the table owns', () => {
    expect(ownValue({ table, key: 'success' })).toBe('ok');
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'answers undefined for the inherited key %s',
    (key) => {
      expect(ownValue({ table, key })).toBeUndefined();
    },
  );

  it('answers undefined for a key the table lacks', () => {
    expect(ownValue({ table, key: 'missing' })).toBeUndefined();
  });
});
