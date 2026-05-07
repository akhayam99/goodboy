import type { ProviderUsage } from '@kay-am/types';

// cursor-agent routes requests through Cursor's subscription model — actual token prices
// are not publicly documented. Using conservative estimates mirroring sonnet-tier pricing
// as a placeholder. TODO (@ak): update when Cursor publishes per-token pricing (#71).
interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
}

// cursor-small is the documented cheap-tier alias in cursor-agent's model list.
// The underlying model may change; the alias is stable per Cursor docs.
export const CURSOR_CHEAP_MODEL = 'cursor-small';

const PRICES: Record<string, ModelPrice> = {
  [CURSOR_CHEAP_MODEL]: {
    inputPerMtok: 0.15,
    outputPerMtok: 0.6,
    cachedInputPerMtok: 0.015,
  },
  'claude-sonnet-4-5': {
    inputPerMtok: 3,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.3,
  },
  'gpt-4o': {
    inputPerMtok: 5,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.5,
  },
};

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
