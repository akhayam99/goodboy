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
});
