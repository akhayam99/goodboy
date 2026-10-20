import { describe, expect, it } from 'vitest';
import { usageCardOf } from './usageCardOf';

describe('usageCardOf', () => {
  it('turns the cap into three rows, not one sentence', () => {
    const card = usageCardOf({
      provider: 'anthropic',
      spentUsd: 70,
      capUsd: 100,
      pctUsed: 70,
      reset: 'Nov 1',
    });

    expect(card.title).toBe('Claude');
    expect(card.facts.map((fact) => fact.label)).toEqual(['Spent', 'Used', 'Resets']);
    expect(card.facts[0]?.note).toBe('of $100.00');
    expect(card.facts[2]?.value).toBe('Nov 1');
  });

  it('warns while there is room and turns danger near the cap', () => {
    const base = { provider: 'anthropic', spentUsd: 1, capUsd: 100, reset: 'Nov 1' } as const;

    expect(usageCardOf({ ...base, pctUsed: 70 }).facts[1]?.tone).toBe('warning');
    expect(usageCardOf({ ...base, pctUsed: 90 }).facts[1]?.tone).toBe('danger');
  });
});
