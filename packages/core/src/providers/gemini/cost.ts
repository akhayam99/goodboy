import type { ProviderUsage } from '@goodboy/types';

// gemini-cli does not surface token counts in its current output stream. Cost
// is therefore not computable from usage data alone. Users on a paid Google AI
// tier can wire a per-model override via providerPricingConfig in app settings;
// overrides are applied in the desktop layer before recording telemetry.
// Default: 0 (free tier / cost unknown).
export function computeGeminiCostUsd(
  usage: ProviderUsage,
  _model: string,
  override: GeminiModelPriceOverride | null,
): number {
  if (override === null) return 0;
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * override.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * (override.cachedInputPerMtok ?? override.inputPerMtok)) / 1_000_000 +
    (usage.outputTokens * override.outputPerMtok) / 1_000_000
  );
}

export interface GeminiModelPriceOverride {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
}
