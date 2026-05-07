import type { ProviderUsage } from '@kay-am/types';

// Codex CLI does not expose token counts in its output stream. Cost is therefore
// not computable from usage data alone. Users who want cost attribution for Codex
// can set per-model override prices via providerPricingConfig in app settings;
// those overrides are applied in the desktop layer before recording telemetry.
// Default: 0 (unmetered / cost unknown).
export function computeCodexCostUsd(
  usage: ProviderUsage,
  _model: string,
  override: CodexModelPriceOverride | null,
): number {
  if (override === null) return 0;
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * override.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * (override.cachedInputPerMtok ?? override.inputPerMtok)) / 1_000_000 +
    (usage.outputTokens * override.outputPerMtok) / 1_000_000
  );
}

export interface CodexModelPriceOverride {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
}
