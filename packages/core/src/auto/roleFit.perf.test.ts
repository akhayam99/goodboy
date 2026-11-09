import { describe, expect, it } from 'vitest';
import { roleFitOf } from './roleFit';

describe('roleFitOf', () => {
  it('scans a long hostile text in linear time', () => {
    const task = `${'open the '.repeat(20_000)}${'squash '.repeat(20_000)}${'.'.repeat(20_000)} add tests`;
    const startedAt = Date.now();
    const fit = roleFitOf({ title: 'failing '.repeat(5_000), task });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(fit).toBeNull();
  });

  it('finds a trigger at the end of a long task', () => {
    const task = `${'Change the parser of ledger-core and keep the tests green. '.repeat(2_000)}Then fix the red lint check.`;
    expect(roleFitOf({ title: null, task })).toBe('ci-fixer');
  });
});
