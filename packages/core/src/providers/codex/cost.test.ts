import { describe, expect, it } from 'vitest';
import type { ProviderUsage } from '@goodboy/types';
import { CODEX_PRICES, computeCodexCostUsd } from './cost';
import { CODEX_CATALOG } from './catalog';

const usage: ProviderUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('computeCodexCostUsd', () => {
  it('prices every catalog cli id', () => {
    const modelIds = CODEX_CATALOG.flatMap((model) =>
      model.variants.map((variant) => variant.cliId),
    );

    for (const model of modelIds) {
      expect(CODEX_PRICES[model]).toBeDefined();
      expect(computeCodexCostUsd({ usage, model })).toBeGreaterThan(0);
    }
  });

  it('uses the verified gpt-5.6 variant prices', () => {
    expect(computeCodexCostUsd({ usage, model: 'gpt-5.6-sol' })).toBeCloseTo(35);
    expect(computeCodexCostUsd({ usage, model: 'gpt-5.6-terra' })).toBeCloseTo(17.5);
    expect(computeCodexCostUsd({ usage, model: 'gpt-5.6-luna' })).toBeCloseTo(7);
  });

  it('bills cached input at ten percent of input', () => {
    const cachedUsage: ProviderUsage = {
      inputTokens: 2_000_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
      estimatedCostUsd: 0,
    };

    expect(computeCodexCostUsd({ usage: cachedUsage, model: 'gpt-5.4-mini' })).toBeCloseTo(
      0.75 + 0.075,
    );
  });

  it('honors a supplied desktop override', () => {
    expect(
      computeCodexCostUsd({
        usage,
        model: 'gpt-5.6-sol',
        override: { inputPerMtok: 3, outputPerMtok: 15 },
      }),
    ).toBeCloseTo(18);
  });

  it('bills cache creation at 1.25 times the input rate', () => {
    const cacheCreationUsage: ProviderUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 200_000,
      estimatedCostUsd: 0,
    };

    expect(computeCodexCostUsd({ usage: cacheCreationUsage, model: 'gpt-5.6-sol' })).toBeCloseTo(
      1.25,
    );
  });

  it('returns zero for unknown models', () => {
    expect(computeCodexCostUsd({ usage, model: 'unknown-codex-model' })).toBe(0);
  });
});
