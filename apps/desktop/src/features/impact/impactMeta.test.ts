// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { impactMeta } from './impactMeta';

describe('impactMeta', () => {
  it('names the range, the sessions done and the spend of that range', () => {
    expect(impactMeta({ rangeLabel: '30 days', sessionCount: 14, spentUsd: 151.72 })).toBe(
      '30 days · 14 sessions done · $151.72 spent',
    );
  });

  it('says one session in the singular', () => {
    expect(impactMeta({ rangeLabel: '7 days', sessionCount: 1, spentUsd: 3 })).toBe(
      '7 days · 1 session done · $3.00 spent',
    );
  });

  it('keeps a quiet range to the count alone', () => {
    expect(impactMeta({ rangeLabel: '30 days', sessionCount: 0, spentUsd: 9.1 })).toBe(
      '0 sessions done',
    );
  });

  it('shows only the range while the count has not loaded', () => {
    expect(impactMeta({ rangeLabel: 'All time', sessionCount: null, spentUsd: 4 })).toBe(
      'All time',
    );
  });
});
