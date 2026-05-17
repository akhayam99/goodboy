import type { CodexModelPriceOverride } from '@kay-am/core';
import shippedPricing from './pricing.json';

interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
}

export interface PricingTable {
  readonly version: string;
  readonly anthropic: Record<string, ModelPrice>;
  readonly cursor: Record<string, ModelPrice>;
  readonly codex: Record<string, ModelPrice>;
}

const activeTable: PricingTable = shippedPricing as PricingTable;

export function getActivePricingTable(): PricingTable {
  return activeTable;
}

// Remote CDN refresh is intentionally disabled — the previous placeholder URL
// (`kay-am.dev/pricing.json`) was never provisioned, so the fetch failed DNS at
// every boot and spammed DevTools with `Failed to load resource` 3×. The shipped
// `data/pricing.json` is authoritative until a real CDN endpoint exists.
export async function refreshPricingTable(): Promise<void> {
  return;
}

// Dev-only override: merged on top of the active pricing table when IS_DEV is true.
// Set window.__DEV_PRICING_OVERRIDE__ in devtools to test alternate prices.
declare global {
  interface Window {
    __DEV_PRICING_OVERRIDE__?: Partial<PricingTable>;
  }
}

const IS_DEV = import.meta.env.DEV === true;

function priceForModel(
  provider: 'anthropic' | 'cursor' | 'codex',
  model: string,
): ModelPrice | null {
  const table: PricingTable =
    IS_DEV && typeof window !== 'undefined' && window.__DEV_PRICING_OVERRIDE__
      ? { ...activeTable, ...window.__DEV_PRICING_OVERRIDE__ }
      : activeTable;

  return table[provider][model] ?? null;
}

// Legacy compat: getCodexPriceOverride still works but now reads from the shipped table.
export function getCodexPriceOverride(
  _config: unknown,
  model: string,
): CodexModelPriceOverride | null {
  const price = priceForModel('codex', model);
  if (price === null) return null;
  return {
    inputPerMtok: price.inputPerMtok,
    outputPerMtok: price.outputPerMtok,
    ...(price.cachedInputPerMtok !== undefined
      ? { cachedInputPerMtok: price.cachedInputPerMtok }
      : {}),
  };
}
