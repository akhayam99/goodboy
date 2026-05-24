import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeCostUsd } from './cost';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('computeCostUsd', () => {
  it('opus 4.7 pricing (5 + 25 per Mtok)', () => {
    expect(computeCostUsd(usage, 'claude-opus-4-7')).toBeCloseTo(5 + 25);
  });

  it('sonnet pricing', () => {
    expect(computeCostUsd(usage, 'claude-sonnet-4-6')).toBeCloseTo(3 + 15);
  });

  it('haiku pricing', () => {
    expect(computeCostUsd(usage, 'claude-haiku-4-5')).toBeCloseTo(1 + 5);
  });

  it('unknown model falls back to sonnet pricing', () => {
    expect(computeCostUsd(usage, 'claude-vapor-9-9')).toBeCloseTo(3 + 15);
  });

  it('cached tokens are billed at the discounted rate', () => {
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    // sonnet: 1M billable @ $3 + 1M cached @ $0.3
    expect(computeCostUsd(partial, 'claude-sonnet-4-6')).toBeCloseTo(3 + 0.3);
  });

  it('cache-write tokens billed at 5m + 1h tiers (sonnet)', () => {
    const withWrites: ProviderUsage = {
      // 3M total reported as input: 1M fresh, 500k cache-read, 1M write-5m, 500k write-1h
      inputTokens: 3_000_000,
      outputTokens: 0,
      cachedInputTokens: 500_000,
      cacheCreation5mTokens: 1_000_000,
      cacheCreation1hTokens: 500_000,
      estimatedCostUsd: 0,
    };
    // sonnet: 1M fresh @ $3 + 500k cache-read @ $0.3 + 1M write-5m @ $3.75 + 500k write-1h @ $6
    const expected = 3 + 0.15 + 3.75 + 3;
    expect(computeCostUsd(withWrites, 'claude-sonnet-4-6')).toBeCloseTo(expected);
  });

  it('opus 4.6 matches 4.7 pricing', () => {
    expect(computeCostUsd(usage, 'claude-opus-4-6')).toBeCloseTo(
      computeCostUsd(usage, 'claude-opus-4-7'),
    );
  });
});
