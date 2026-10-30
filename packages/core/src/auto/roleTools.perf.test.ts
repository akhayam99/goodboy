import { describe, expect, it } from 'vitest';
import { commandMentionOf } from './roleTools';

describe('commandMentionOf', () => {
  it('scans a long hostile text in linear time', () => {
    const text = `${'no '.repeat(20_000)}x ${'git '.repeat(20_000)}`;
    const startedAt = Date.now();
    const found = commandMentionOf({ text });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(found).toBe('git git');
  });
});
