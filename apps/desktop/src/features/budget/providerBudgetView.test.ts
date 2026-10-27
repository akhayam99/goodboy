// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { budgetScopeNote, budgetTone } from './providerBudgetView';
import { providerBudgetStatusFor } from './testing/providerBudgetFixture';

describe('budgetTone', () => {
  it('reads the standing the backend decided, not a ratio of its own', () => {
    expect(budgetTone({ status: providerBudgetStatusFor({ spentUsd: 50, capUsd: 100 }) })).toBe(
      'primary',
    );
    expect(budgetTone({ status: providerBudgetStatusFor({ spentUsd: 85, capUsd: 100 }) })).toBe(
      'warning',
    );
    expect(budgetTone({ status: providerBudgetStatusFor({ spentUsd: 100, capUsd: 100 }) })).toBe(
      'danger',
    );
  });

  it('follows the rule threshold, so a 50 percent rule warns at half', () => {
    const status = providerBudgetStatusFor({ spentUsd: 50, capUsd: 100, thresholdPct: 50 });

    expect(budgetTone({ status })).toBe('warning');
  });
});

describe('budgetScopeNote', () => {
  it('says the month resets in the local calendar, not on a UTC clock', () => {
    const note = budgetScopeNote({ status: providerBudgetStatusFor({ spentUsd: 1, capUsd: 100 }) });

    expect(note).toMatch(/^Across all workspaces\. The month resets .+ your time\.$/);
    expect(note).not.toContain('UTC');
  });
});
