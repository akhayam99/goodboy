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
  it('opus pricing', () => {
    expect(computeCostUsd(usage, 'claude-opus-4-7')).toBeCloseTo(15 + 75);
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
});
