import type { ProviderUsage } from '@kay-am/types';

// Cursor proxies agent requests through its own gateway under a flat Pro
// subscription tier. Per-token prices are not published. The mapping below uses
// the underlying provider's public list price as the best available cost proxy —
// this approximates the premium-request consumption Cursor users are billed for.
// Source: Anthropic + OpenAI public pricing (verified 2026-05).
interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
}

// `composer-2-fast` is Cursor's CLI default cheap tier (per `cursor-agent models`).
export const CURSOR_CHEAP_MODEL = 'composer-2-fast';

const COMPOSER_PRICE: ModelPrice = {
  inputPerMtok: 0.8,
  outputPerMtok: 4,
  cachedInputPerMtok: 0.08,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 15,
  outputPerMtok: 75,
  cachedInputPerMtok: 1.5,
};
const GPT5_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.5,
};

const PRICES: Record<string, ModelPrice> = {
  // Cursor's first-party Composer family — cheap tier proxy pricing.
  [CURSOR_CHEAP_MODEL]: COMPOSER_PRICE,
  'composer-2': COMPOSER_PRICE,
  auto: COMPOSER_PRICE,

  // Claude-family models surfaced via Cursor's CLI.
  'claude-opus-4-7-thinking-high': OPUS_PRICE,
  'claude-4.6-opus-high-thinking': OPUS_PRICE,
  'claude-4.6-opus-high-thinking-fast': OPUS_PRICE,
  'claude-4.6-sonnet-medium': SONNET_PRICE,
  'claude-4.6-sonnet-high': SONNET_PRICE,
  'claude-sonnet-4-5': SONNET_PRICE,
  'claude-sonnet-4-6': SONNET_PRICE,

  // GPT-5 family surfaced via Cursor's CLI.
  'gpt-5.5-high': GPT5_PRICE,
  'gpt-5.5-medium': GPT5_PRICE,
  'gpt-5.3-codex': GPT5_PRICE,
  'gpt-4o': GPT5_PRICE,
};

const FALLBACK: ModelPrice = COMPOSER_PRICE;

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
