import { describe, expect, it } from 'vitest';
import { providerBudgetStatusFor } from './testing/providerBudgetFixture';
import { limitTiersOf, monthTiersOf } from './limitTiersOf';

describe('limitTiersOf', () => {
  it('reads the session, then each provider month', () => {
    const months = monthTiersOf({
      statuses: { anthropic: providerBudgetStatusFor({ spentUsd: 41.2, capUsd: 200 }) },
    });

    expect(limitTiersOf({ session: { capUsd: 20, spentUsd: 3.5 }, months })).toBe(
      'Session $3.50 of $20.00 · Claude $41.20 of $200.00 this month',
    );
  });

  it('says nothing for a tier that has no limit', () => {
    expect(limitTiersOf({ session: { capUsd: null, spentUsd: 4 }, months: [] })).toBe('');
  });

  it('skips a provider without a monthly cap', () => {
    expect(monthTiersOf({ statuses: { codex: undefined } })).toEqual([]);
  });
});
