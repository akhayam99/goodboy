import type { ProviderUsage } from '@goodboy/types';

type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
};

const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 15,
  outputPerMtok: 75,
  cachedInputPerMtok: 1.5,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};

const PRICES: Record<string, ModelPrice> = {
  'claude-opus-4-8': OPUS_PRICE,
  'claude-opus-4-7': OPUS_PRICE,
  'claude-opus-4-6': OPUS_PRICE,
  'claude-sonnet-4-6': SONNET_PRICE,
  'claude-sonnet-4-5': SONNET_PRICE,
  'claude-haiku-4-5': {
    inputPerMtok: 1,
    outputPerMtok: 5,
    cachedInputPerMtok: 0.1,
  },
};

const FALLBACK: ModelPrice = PRICES['claude-sonnet-4-6']!;

export const priceFor = (model: string): ModelPrice => {
  return PRICES[model] ?? FALLBACK;
};

export const computeCostUsd = (usage: ProviderUsage, model: string): number => {
  const price = priceFor(model);
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
};
