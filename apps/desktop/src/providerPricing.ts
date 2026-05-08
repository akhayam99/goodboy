import type { CodexModelPriceOverride } from '@kay-am/core';
import shippedPricing from './data/pricing.json';

// CDN URL for remote pricing refresh.
// Replace with actual hosted URL before production release.
const PRICING_CDN_URL = 'https://kay-am.dev/pricing.json';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export interface ModelPrice {
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

function isPricingTable(value: unknown): value is PricingTable {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['version'] === 'string' &&
    typeof v['anthropic'] === 'object' &&
    typeof v['cursor'] === 'object' &&
    typeof v['codex'] === 'object'
  );
}

let activeTable: PricingTable = shippedPricing as PricingTable;
let lastFetchAt = 0;
let lastEtag: string | null = null;

export function getActivePricingTable(): PricingTable {
  return activeTable;
}

export async function refreshPricingTable(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchAt < REFRESH_INTERVAL_MS) return;

  try {
    const headers: Record<string, string> = {};
    if (lastEtag !== null) headers['If-None-Match'] = lastEtag;

    const res = await fetch(PRICING_CDN_URL, { headers });

    if (res.status === 304) {
      lastFetchAt = now;
      return;
    }

    if (!res.ok) return;

    const etag = res.headers.get('ETag');
    const body: unknown = await res.json();

    if (isPricingTable(body)) {
      activeTable = body;
      lastFetchAt = now;
      if (etag !== null) lastEtag = etag;
    }
  } catch {
    // network failure — keep current table
  }
}

// Dev-only override: merged on top of the active pricing table when IS_DEV is true.
// Set window.__DEV_PRICING_OVERRIDE__ in devtools to test alternate prices.
declare global {
  interface Window {
    __DEV_PRICING_OVERRIDE__?: Partial<PricingTable>;
  }
}

const IS_DEV = import.meta.env.DEV === true;

export function priceForModel(
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

// Legacy compat: kept for existing callers that used to pass raw JSON string.
export function parseProviderPricingConfig(_raw: string | null): unknown {
  return {};
}

// Kept for ProviderPricingConfig shape compatibility in tests.
export type ProviderPricingConfig = Record<string, never>;
