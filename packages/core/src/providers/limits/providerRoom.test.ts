import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderBudgetStatus,
  type ProviderLimits,
} from '@goodboy/types';
import { providerRoom } from './providerRoom';

const NOW = Date.parse('2026-11-24T10:00:00.000Z');
const MINUTE = 60_000;

type LimitsParams = {
  readonly used: number;
  readonly ageMinutes?: number;
};

const limits = ({ used, ageMinutes = 0 }: LimitsParams): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: used,
      resetsAt: brandId<IsoDateTime>({ value: new Date(NOW + 60 * MINUTE).toISOString() }),
    },
  ],
  observedAt: brandId<IsoDateTime>({ value: new Date(NOW - ageMinutes * MINUTE).toISOString() }),
});

type BudgetParams = {
  readonly pct: number;
  readonly capUsd?: number | null;
};

const budget = ({ pct, capUsd = 100 }: BudgetParams): ProviderBudgetStatus => ({
  remainingUsd: capUsd === null ? null : capUsd - pct,
  pct,
  exceeded: pct >= 100,
  overThreshold: pct >= 80,
  spentUsd: pct,
  capUsd,
  thresholdPct: 80,
  windowStartMs: NOW - 10 * 24 * 60 * MINUTE,
  windowEndMs: NOW + 20 * 24 * 60 * MINUTE,
});

type EstimateParams = {
  readonly cleanTurns?: number;
  readonly load?: number;
  readonly lastRateLimitAtMs?: number | null;
};

const estimate = ({ cleanTurns = 0, load = 0, lastRateLimitAtMs = null }: EstimateParams) =>
  providerRoom({
    providerId: 'cursor',
    limits: undefined,
    cleanTurns,
    load,
    lastRateLimitAtMs,
    nowMs: NOW,
  });

describe('providerRoom', () => {
  it('reads the measured share for a provider that reports usage', () => {
    expect(
      providerRoom({
        providerId: 'anthropic',
        limits: limits({ used: 0.42 }),
        cleanTurns: 30,
        load: 4,
        lastRateLimitAtMs: NOW,
        nowMs: NOW,
      }),
    ).toEqual({ usedPercent: 42, isEstimated: false });
  });

  it('estimates a provider whose reading went stale', () => {
    expect(
      providerRoom({
        providerId: 'anthropic',
        limits: limits({ used: 0.1, ageMinutes: 45 }),
        cleanTurns: 0,
        load: 0,
        lastRateLimitAtMs: null,
        nowMs: NOW,
      }),
    ).toEqual({ usedPercent: 50, isEstimated: true });
  });

  it('starts a provider with no reading in the middle, never at zero', () => {
    expect(estimate({})).toEqual({ usedPercent: 50, isEstimated: true });
  });

  it('lowers the estimate by two points per clean turn, down to 30', () => {
    expect(estimate({ cleanTurns: 5 }).usedPercent).toBe(40);
    expect(estimate({ cleanTurns: 40 }).usedPercent).toBe(30);
  });

  it('adds ten points per agent on the provider', () => {
    expect(estimate({ cleanTurns: 5, load: 2 }).usedPercent).toBe(60);
  });

  it('puts a rate limit in the last hour at 85 or more', () => {
    expect(estimate({ lastRateLimitAtMs: NOW - 30 * MINUTE }).usedPercent).toBe(85);
    expect(estimate({ lastRateLimitAtMs: NOW - 30 * MINUTE, load: 4 }).usedPercent).toBe(90);
  });

  it('forgets a rate limit older than an hour', () => {
    expect(estimate({ lastRateLimitAtMs: NOW - 61 * MINUTE }).usedPercent).toBe(50);
  });

  it('never estimates a provider as full, so a guess never removes it', () => {
    expect(estimate({ load: 20, lastRateLimitAtMs: NOW })).toEqual({
      usedPercent: 95,
      isEstimated: true,
    });
  });

  it('reads the budget left when one is set and no usage is reported', () => {
    expect(
      providerRoom({
        providerId: 'opencode',
        limits: undefined,
        budget: budget({ pct: 64.4 }),
        cleanTurns: 0,
        load: 3,
        lastRateLimitAtMs: null,
        nowMs: NOW,
      }),
    ).toEqual({ usedPercent: 64, isEstimated: false });
  });

  it('estimates when the budget has no cap', () => {
    expect(
      providerRoom({
        providerId: 'opencode',
        limits: undefined,
        budget: budget({ pct: 0, capUsd: null }),
        cleanTurns: 0,
        load: 0,
        lastRateLimitAtMs: null,
        nowMs: NOW,
      }),
    ).toEqual({ usedPercent: 50, isEstimated: true });
  });
});
