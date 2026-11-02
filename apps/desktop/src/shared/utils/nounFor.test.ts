import { describe, expect, it } from 'vitest';
import { nounFor } from './nounFor';

describe('nounFor', () => {
  it('picks the singular for exactly one and the plural otherwise', () => {
    expect(nounFor({ count: 1, one: 'step' })).toBe('step');
    expect(nounFor({ count: 0, one: 'step' })).toBe('steps');
    expect(nounFor({ count: 2, one: 'reply', many: 'replies' })).toBe('replies');
  });
});
