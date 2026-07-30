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
  it('fable-5 pricing, not the sonnet fallback', () => {
    expect(computeCostUsd({ usage, model: 'claude-fable-5' })).toBeCloseTo(10 + 50);
  });

  it('opus pricing', () => {
    expect(computeCostUsd({ usage, model: 'claude-opus-4-7' })).toBeCloseTo(5 + 25);
  });

  it('opus-5 is priced as opus', () => {
    expect(computeCostUsd({ usage, model: 'claude-opus-5' })).toBeCloseTo(5 + 25);
  });

  it('opus-4-8 is priced as opus', () => {
    expect(computeCostUsd({ usage, model: 'claude-opus-4-8' })).toBeCloseTo(5 + 25);
  });

  it('opus-4-6 is priced as opus, not the sonnet fallback', () => {
    expect(computeCostUsd({ usage, model: 'claude-opus-4-6' })).toBeCloseTo(5 + 25);
  });

  it('sonnet pricing', () => {
    expect(computeCostUsd({ usage, model: 'claude-sonnet-4-6' })).toBeCloseTo(3 + 15);
  });

  it('sonnet-4-5 is priced as sonnet', () => {
    expect(computeCostUsd({ usage, model: 'claude-sonnet-4-5' })).toBeCloseTo(3 + 15);
  });

  it('haiku pricing', () => {
    expect(computeCostUsd({ usage, model: 'claude-haiku-4-5' })).toBeCloseTo(1 + 5);
  });

  it('unknown model falls back to sonnet pricing', () => {
    expect(computeCostUsd({ usage, model: 'claude-vapor-9-9' })).toBeCloseTo(3 + 15);
  });

  it('cached tokens are billed at the discounted rate', () => {
    const partial: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCostUsd({ usage: partial, model: 'claude-sonnet-4-6' })).toBeCloseTo(3 + 0.3);
  });
});
