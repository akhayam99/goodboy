import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeCostUsd, priceFor } from './cost';

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

  it('opus-5-5 has its own price, cheaper than opus-5', () => {
    expect(computeCostUsd({ usage, model: 'claude-opus-5-5' })).toBeCloseTo(4 + 20);
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

  it('sonnet-5 has its own price, cheaper than sonnet-4-6', () => {
    expect(computeCostUsd({ usage, model: 'claude-sonnet-5' })).toBeCloseTo(2 + 10);
  });

  it('sonnet-5-5 carries the measured sonnet 5 rate, not the sonnet fallback', () => {
    expect(computeCostUsd({ usage, model: 'claude-sonnet-5-5' })).toBeCloseTo(2 + 10);
  });

  it('sonnet-5-5 cached tokens are billed at 0.10, half the sonnet 5 cache rate', () => {
    const partial: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCostUsd({ usage: partial, model: 'claude-sonnet-5-5' })).toBeCloseTo(0.1);
  });

  it('haiku-5-5 bills a request above 100,000 prompt tokens at five times the rate', () => {
    const request = {
      inputTokens: 20_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 90_000,
      cacheCreationInputTokens: 0,
    };
    const turn: ProviderUsage = {
      inputTokens: 30_000,
      outputTokens: 1_500_000,
      cachedInputTokens: 130_000,
      cacheCreationInputTokens: 0,
      largeRequests: [request],
      estimatedCostUsd: 0,
    };
    const large = (20_000 * 0.5 + 90_000 * 0.05 + 1_000_000 * 2.5) / 1_000_000;
    const rest = (10_000 * 0.1 + 40_000 * 0.01 + 500_000 * 0.5) / 1_000_000;
    expect(computeCostUsd({ usage: turn, model: 'claude-haiku-5-5' })).toBeCloseTo(large + rest);
  });

  it('haiku-5-5 bills a request of exactly 100,000 prompt tokens at the lower rate', () => {
    const request = {
      inputTokens: 100_000,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
    };
    const turn: ProviderUsage = { ...request, largeRequests: [request], estimatedCostUsd: 0 };
    expect(computeCostUsd({ usage: turn, model: 'claude-haiku-5-5' })).toBeCloseTo(0.01);
  });

  it('a model without a size level ignores large requests', () => {
    const request = {
      inputTokens: 200_000,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
    };
    const turn: ProviderUsage = { ...request, largeRequests: [request], estimatedCostUsd: 0 };
    expect(computeCostUsd({ usage: turn, model: 'claude-sonnet-5-5' })).toBeCloseTo(0.4);
  });

  it('haiku-5-5 bills the rate for prompts up to 100,000 tokens, measured', () => {
    const cached: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCostUsd({ usage, model: 'claude-haiku-5-5' })).toBeCloseTo(0.1 + 0.5);
    expect(computeCostUsd({ usage: cached, model: 'claude-haiku-5-5' })).toBeCloseTo(0.01);
    expect(priceFor('claude-haiku-5-5').assumed).toBeUndefined();
  });

  it('sonnet-5 cached tokens are billed at 10% of input', () => {
    const partial: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };
    expect(computeCostUsd({ usage: partial, model: 'claude-sonnet-5' })).toBeCloseTo(0.2);
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
    expect(computeCostUsd({ usage: partial, model: 'claude-sonnet-4-6' })).toBeCloseTo(6 + 0.3);
  });

  it('bills cache creation at 1.25 times the input rate', () => {
    const cacheCreationUsage: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 200_000,
      estimatedCostUsd: 0,
    };

    expect(computeCostUsd({ usage: cacheCreationUsage, model: 'claude-opus-5' })).toBeCloseTo(1.25);
  });
});
