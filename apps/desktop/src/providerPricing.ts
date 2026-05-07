import type { CodexModelPriceOverride } from '@kay-am/core';

// Stored as JSON under SETTING_PROVIDER_PRICING_CONFIG.
// Currently only codex needs user-supplied prices; other providers have real pricing from stream.
export interface ProviderPricingConfig {
  readonly codex?: Readonly<Record<string, CodexModelPriceOverride>>;
}

export function parseProviderPricingConfig(raw: string | null): ProviderPricingConfig {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as ProviderPricingConfig;
  } catch {
    return {};
  }
}

export function getCodexPriceOverride(
  config: ProviderPricingConfig,
  model: string,
): CodexModelPriceOverride | null {
  const entry = config.codex?.[model];
  if (!entry) return null;
  if (typeof entry.inputPerMtok !== 'number' || typeof entry.outputPerMtok !== 'number') {
    return null;
  }
  return entry;
}
