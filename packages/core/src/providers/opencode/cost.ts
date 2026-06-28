import type { ProviderUsage } from '@goodboy/types';

export type OpenCodeModelPriceOverride = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
};

const DEFAULT_PRICES: Record<string, OpenCodeModelPriceOverride> = {
  'claude-sonnet-4-5': {
    inputPerMtok: 3.0,
    outputPerMtok: 15.0,
    cachedInputPerMtok: 0.3,
  },
  'gpt-4o': {
    inputPerMtok: 2.5,
    outputPerMtok: 10.0,
  },
  'gpt-4o-mini': {
    inputPerMtok: 0.15,
    outputPerMtok: 0.6,
  },
  'gemini-2.5-pro': {
    inputPerMtok: 1.25,
    outputPerMtok: 10.0,
  },
  'gemini-2.5-flash': {
    inputPerMtok: 0.15,
    outputPerMtok: 0.6,
  },
};

export const computeOpenCodeCostUsd = (
  usage: ProviderUsage,
  model: string,
  override: OpenCodeModelPriceOverride | null,
): number => {
  if (override === null) {
    const defaultPrice = DEFAULT_PRICES[model];
    if (defaultPrice === undefined) {
      return 0;
    }
    return calculateCost(usage, defaultPrice);
  }
  return calculateCost(usage, override);
};

const calculateCost = (usage: ProviderUsage, prices: OpenCodeModelPriceOverride): number => {
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * prices.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * (prices.cachedInputPerMtok ?? prices.inputPerMtok)) / 1_000_000 +
    (usage.outputTokens * prices.outputPerMtok) / 1_000_000
  );
};
