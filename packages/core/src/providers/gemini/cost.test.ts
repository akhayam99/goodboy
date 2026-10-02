import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeGeminiCostUsd } from './cost';

describe('computeGeminiCostUsd', () => {
  it('bills cache creation at 1.25 times the input rate', () => {
    const usage: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 200_000,
      estimatedCostUsd: 0,
    };

    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.1-pro' })).toBeCloseTo(0.5);
  });

  it('bills the flash models at the published 0.75 and 3.75 rates', () => {
    const usage: ProviderUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
    };

    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.8-flash' })).toBeCloseTo(4.5);
    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.7-flash' })).toBeCloseTo(4.5);
    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.6-flash' })).toBeCloseTo(4.5);
    expect(computeGeminiCostUsd({ usage, model: 'gemini-3.5-flash' })).toBeCloseTo(10.5);
  });
});
