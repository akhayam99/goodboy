import type { ProviderUsage } from '@goodboy/types';

export const computeGeminiCostUsd = (
  usage: ProviderUsage,
  _model: string,
  override: GeminiModelPriceOverride | null,
): number => {
  if (override === null) {
    return 0;
  }
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * override.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * (override.cachedInputPerMtok ?? override.inputPerMtok)) / 1_000_000 +
    (usage.outputTokens * override.outputPerMtok) / 1_000_000
  );
};

export type GeminiModelPriceOverride = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
};
