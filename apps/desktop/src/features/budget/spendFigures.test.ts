// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { providerBudgetStatusFor } from './testing/providerBudgetFixture';
import { spendFigures, totalUsd } from './spendFigures';

const NOW = new Date(2026, 9, 17, 15, 0, 0).getTime();
const DAY_MS = 86_400_000;

const isoOf = ({ ms }: { readonly ms: number }): IsoDateTime =>
  JSON.parse(JSON.stringify(new Date(ms).toISOString()));

const recordAt = ({ ms, usd }: { readonly ms: number; readonly usd: number }) => ({
  recordedAt: isoOf({ ms }),
  estimatedCostUsd: usd,
});

const RECORDS = [
  recordAt({ ms: NOW - 60_000, usd: 2 }),
  recordAt({ ms: NOW - 2 * DAY_MS, usd: 5 }),
  recordAt({ ms: NOW - 20 * DAY_MS, usd: 11 }),
  recordAt({ ms: NOW - 45 * DAY_MS, usd: 23 }),
];

describe('spendFigures', () => {
  it('names a window for every figure and sums each one apart', () => {
    const figures = spendFigures({ records: RECORDS, nowMs: NOW, sinceMs: NOW - 30 * DAY_MS });

    expect(figures.today).toEqual({ window: 'today', usd: 2 });
    expect(figures.range).toEqual({ window: 'range', usd: 18 });
    expect(figures.month).toBeNull();
    expect(figures.limit).toBeNull();
  });

  it('counts every record when the range is all time', () => {
    const figures = spendFigures({ records: RECORDS, nowMs: NOW, sinceMs: null });

    expect(figures.range.usd).toBe(41);
    expect(figures.today.usd).toBe(2);
  });

  it('keeps today out of a range that starts after it', () => {
    const figures = spendFigures({ records: RECORDS, nowMs: NOW, sinceMs: NOW + 1 });

    expect(figures.range.usd).toBe(0);
    expect(figures.today.usd).toBe(0);
  });

  it('reads the month and the limit from the provider status, never from the records', () => {
    const budget = providerBudgetStatusFor({ spentUsd: 152.37, capUsd: 170, thresholdPct: 80 });
    const figures = spendFigures({
      records: RECORDS,
      nowMs: NOW,
      sinceMs: NOW - 30 * DAY_MS,
      budget,
    });

    expect(figures.month).toEqual({ window: 'month', usd: 152.37 });
    expect(figures.range.usd).toBe(18);
    expect(figures.limit).toMatchObject({
      limitUsd: 170,
      pctUsed: 90,
      warnFraction: 0.8,
      resetsAtMs: budget.windowEndMs + 1,
    });
    expect(figures.limit?.leftUsd).toBeCloseTo(17.63, 2);
  });

  it('floors what is left at zero over the limit', () => {
    const budget = providerBudgetStatusFor({ spentUsd: 12, capUsd: 10 });

    expect(spendFigures({ records: [], nowMs: NOW, sinceMs: null, budget }).limit?.leftUsd).toBe(0);
  });

  it('has a month and no limit for a provider without one', () => {
    const budget = { ...providerBudgetStatusFor({ spentUsd: 4, capUsd: 10 }), capUsd: null };
    const figures = spendFigures({ records: [], nowMs: NOW, sinceMs: null, budget });

    expect(figures.month?.usd).toBe(4);
    expect(figures.limit).toBeNull();
  });
});

describe('totalUsd', () => {
  it('adds the cost of the records it is given', () => {
    expect(totalUsd({ records: RECORDS })).toBe(41);
    expect(totalUsd({ records: [] })).toBe(0);
  });
});
