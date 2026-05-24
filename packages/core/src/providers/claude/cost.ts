import type { ProviderUsage } from '@goodboy/types';

export interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
  readonly cacheWrite5mPerMtok: number;
  readonly cacheWrite1hPerMtok: number;
}

// Anthropic published pricing (claude.com/pricing, 2026-Q2). Cache-write
// multipliers: 1.25× base for 5m TTL, 2× for 1h TTL. Cache-read: 0.1× base.
const PRICES: Record<string, ModelPrice> = {
  'claude-opus-4-7': {
    inputPerMtok: 5,
    outputPerMtok: 25,
    cachedInputPerMtok: 0.5,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10,
  },
  'claude-opus-4-6': {
    inputPerMtok: 5,
    outputPerMtok: 25,
    cachedInputPerMtok: 0.5,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10,
  },
  'claude-opus-4-5': {
    inputPerMtok: 5,
    outputPerMtok: 25,
    cachedInputPerMtok: 0.5,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10,
  },
  'claude-sonnet-4-6': {
    inputPerMtok: 3,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.3,
    cacheWrite5mPerMtok: 3.75,
    cacheWrite1hPerMtok: 6,
  },
  'claude-sonnet-4-5': {
    inputPerMtok: 3,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.3,
    cacheWrite5mPerMtok: 3.75,
    cacheWrite1hPerMtok: 6,
  },
  'claude-haiku-4-5': {
    inputPerMtok: 1,
    outputPerMtok: 5,
    cachedInputPerMtok: 0.1,
    cacheWrite5mPerMtok: 1.25,
    cacheWrite1hPerMtok: 2,
  },
};

const FALLBACK: ModelPrice = PRICES['claude-sonnet-4-6']!;

export function priceFor(model: string): ModelPrice {
  return PRICES[model] ?? FALLBACK;
}

export function computeCostUsd(usage: ProviderUsage, model: string): number {
  const price = priceFor(model);
  const cacheWrite5m = usage.cacheCreation5mTokens ?? 0;
  const cacheWrite1h = usage.cacheCreation1hTokens ?? 0;
  // Anthropic counts cached-read + cache-write tokens INSIDE `input_tokens`,
  // so subtract them to get the truly-fresh billable input.
  const billableInput = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens - cacheWrite5m - cacheWrite1h,
  );
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    (cacheWrite5m * price.cacheWrite5mPerMtok) / 1_000_000 +
    (cacheWrite1h * price.cacheWrite1hPerMtok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
}
