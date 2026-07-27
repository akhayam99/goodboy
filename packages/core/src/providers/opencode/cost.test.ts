import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { computeOpenCodeCostUsd } from './cost';

const USAGE: ProviderUsage = {
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 20,
  estimatedCostUsd: 0,
};

describe('computeOpenCodeCostUsd', () => {
  it('returns zero without a reported cost', () => {
    expect(computeOpenCodeCostUsd({ usage: USAGE, model: 'opencode/big-pickle' })).toBe(0);
  });

  it('uses the cost reported by opencode', () => {
    expect(
      computeOpenCodeCostUsd({
        usage: { ...USAGE, estimatedCostUsd: 0.0123 },
        model: 'openrouter/anthropic/claude-sonnet-4.5',
      }),
    ).toBe(0.0123);
  });
});
