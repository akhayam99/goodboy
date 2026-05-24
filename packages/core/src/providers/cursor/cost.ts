import type { ProviderUsage } from '@goodboy/types';

// Cursor proxies agent requests through its own gateway under a flat Pro
// subscription tier. Per-token prices are not published. The mapping below uses
// the underlying provider's public list price as the best available cost proxy —
// this approximates the premium-request consumption Cursor users are billed for.
// Cache-write tiers mirror Anthropic's 1.25× / 2× multipliers.
// Sources: Anthropic + OpenAI public pricing (verified 2026-Q2).
export interface ModelPrice {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
  readonly cacheWrite5mPerMtok: number;
  readonly cacheWrite1hPerMtok: number;
}

// `composer-2.5-fast` is Cursor's CLI default cheap tier (per `cursor-agent models`).
export const CURSOR_CHEAP_MODEL = 'composer-2.5-fast';

// Composer prices: Cursor doesn't publish, use Haiku-tier as cheap proxy.
const COMPOSER_PRICE: ModelPrice = {
  inputPerMtok: 1,
  outputPerMtok: 5,
  cachedInputPerMtok: 0.1,
  cacheWrite5mPerMtok: 1.25,
  cacheWrite1hPerMtok: 2,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
  cacheWrite5mPerMtok: 3.75,
  cacheWrite1hPerMtok: 6,
};
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 25,
  cachedInputPerMtok: 0.5,
  cacheWrite5mPerMtok: 6.25,
  cacheWrite1hPerMtok: 10,
};
const GPT5_PRICE: ModelPrice = {
  inputPerMtok: 1.25,
  outputPerMtok: 10,
  cachedInputPerMtok: 0.125,
  cacheWrite5mPerMtok: 1.5625,
  cacheWrite1hPerMtok: 2.5,
};
const GPT5_MINI_PRICE: ModelPrice = {
  inputPerMtok: 0.25,
  outputPerMtok: 2,
  cachedInputPerMtok: 0.025,
  cacheWrite5mPerMtok: 0.3125,
  cacheWrite1hPerMtok: 0.5,
};
const GEMINI_PRO_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 10,
  cachedInputPerMtok: 0.2,
  cacheWrite5mPerMtok: 2.5,
  cacheWrite1hPerMtok: 4,
};
const GROK_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
  cacheWrite5mPerMtok: 3.75,
  cacheWrite1hPerMtok: 6,
};

// Pricing is keyed by *family*; the resolver below matches a CLI model id to
// the right family by prefix/suffix. This keeps the table small even though
// `cursor-agent models` lists 100+ aliases.
function resolveFamily(model: string): ModelPrice {
  if (model.startsWith('composer-') || model === 'auto') return COMPOSER_PRICE;
  if (/^claude-(\d+\.\d+-)?opus/.test(model) || /^claude-opus-/.test(model)) return OPUS_PRICE;
  if (/^claude-(\d+\.\d+-)?sonnet/.test(model) || /^claude-sonnet-/.test(model))
    return SONNET_PRICE;
  if (/^claude-(\d+\.\d+-)?haiku/.test(model) || /^claude-haiku-/.test(model))
    return COMPOSER_PRICE;
  if (/^gpt-5(\.\d+)?-(mini|nano)/.test(model)) return GPT5_MINI_PRICE;
  if (model.startsWith('gpt-')) return GPT5_PRICE;
  if (model.startsWith('gemini-')) return GEMINI_PRO_PRICE;
  if (model.startsWith('grok-')) return GROK_PRICE;
  return COMPOSER_PRICE;
}

export function cursorPriceFor(model: string): ModelPrice {
  return resolveFamily(model);
}

export function computeCursorCostUsd(usage: ProviderUsage, model: string): number {
  const price = cursorPriceFor(model);
  const cacheWrite5m = usage.cacheCreation5mTokens ?? 0;
  const cacheWrite1h = usage.cacheCreation1hTokens ?? 0;
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
