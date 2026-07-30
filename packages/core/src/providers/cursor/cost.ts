import type { ProviderUsage } from '@goodboy/types';

type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
};

export const CURSOR_CHEAP_MODEL = 'composer-2.5-fast';

const COMPOSER_PRICE: ModelPrice = {
  inputPerMtok: 0.5,
  outputPerMtok: 2.5,
  cachedInputPerMtok: 0.05,
};
const COMPOSER_FAST_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 25,
  cachedInputPerMtok: 0.5,
};
const GPT56_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 30,
  cachedInputPerMtok: 0.5,
};
const GPT54_PRICE: ModelPrice = {
  inputPerMtok: 2.5,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.25,
};

export const CURSOR_PRICES: Record<string, ModelPrice> = {
  [CURSOR_CHEAP_MODEL]: COMPOSER_FAST_PRICE,
  'composer-2.5': COMPOSER_PRICE,
  auto: COMPOSER_PRICE,

  'claude-opus-5-thinking-high': OPUS_PRICE,
  'claude-opus-5-low': OPUS_PRICE,
  'claude-opus-4-7-thinking-high': OPUS_PRICE,
  'claude-4.6-sonnet-medium': SONNET_PRICE,
  'claude-4.6-sonnet-medium-thinking': SONNET_PRICE,

  'gpt-5.6-sol-high': GPT56_PRICE,
  'gpt-5.5-high': GPT56_PRICE,
  'gpt-5.5-medium': GPT56_PRICE,
  'gpt-5.3-codex': GPT54_PRICE,
};

const FALLBACK: ModelPrice = COMPOSER_FAST_PRICE;

export const cursorPriceFor = (model: string): ModelPrice => {
  return CURSOR_PRICES[model] ?? FALLBACK;
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
};

export const computeCursorCostUsd = ({ usage, model }: Params): number => {
  const price = cursorPriceFor(model);
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
};
