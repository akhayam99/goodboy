import type { ProviderUsage } from '@goodboy/types';

// Codex CLI surfaces input/output/cached tokens via its `--json` stream but
// never reports cache-write counts, so cacheWrite5m/1h fields are absent here.
// Cost attribution is opt-in: users may set per-model override prices via
// providerPricingConfig in app settings; without an override the cost is 0
// (unmetered).
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
