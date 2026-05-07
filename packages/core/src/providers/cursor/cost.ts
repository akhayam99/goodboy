import type { ProviderUsage } from '@kay-am/types';

// Cursor proxies agent requests through Anthropic's API under its own subscription tier.
// Per-token prices are not published by Cursor. The mapping below uses the underlying
// Anthropic model's public list prices as the best available cost signal — this is what
// most Cursor users are billed against (premium-request equivalents map to these tiers).
// Source: https://www.anthropic.com/pricing (verified 2026-05)
interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
}

// cursor-small is Cursor's documented cheap-tier alias. The underlying model is not
// disclosed but empirically matches haiku-tier throughput and quality.
export const CURSOR_CHEAP_MODEL = 'cursor-small';

const PRICES: Record<string, ModelPrice> = {
  // Cursor's cheap tier: haiku-equivalent list pricing used as proxy.
  [CURSOR_CHEAP_MODEL]: {
    inputPerMtok: 0.8,
    outputPerMtok: 4,
    cachedInputPerMtok: 0.08,
  },
  // claude-sonnet-4-5 is available in cursor-agent's model roster via Anthropic proxy.
  'claude-sonnet-4-5': {
    inputPerMtok: 3,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.3,
  },
  // claude-sonnet-4-6 added to match the current Anthropic default in cursor-agent.
  'claude-sonnet-4-6': {
    inputPerMtok: 3,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.3,
  },
  // gpt-4o proxied via Cursor's OpenAI partnership.
  'gpt-4o': {
    inputPerMtok: 5,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.5,
  },
};

// Unknown models default to cursor-small (conservative under-estimate).
const FALLBACK: ModelPrice = PRICES[CURSOR_CHEAP_MODEL]!;

export function cursorPriceFor(model: string): ModelPrice {
  return PRICES[model] ?? FALLBACK;
}

export function computeCursorCostUsd(usage: ProviderUsage, model: string): number {
  const price = cursorPriceFor(model);
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
}
