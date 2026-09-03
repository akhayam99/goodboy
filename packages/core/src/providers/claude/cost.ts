import type { ProviderUsage } from '@goodboy/types';

type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
};

const FABLE_PRICE: ModelPrice = {
  inputPerMtok: 10,
  outputPerMtok: 50,
  cachedInputPerMtok: 1,
};
const FABLE_51_PRICE: ModelPrice = {
  inputPerMtok: 10,
  outputPerMtok: 50,
  cachedInputPerMtok: 0.25,
};
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 25,
  cachedInputPerMtok: 0.5,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const SONNET_5_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 10,
  cachedInputPerMtok: 0.2,
};

export const CLAUDE_PRICES: Record<string, ModelPrice> = {
  'claude-fable-5-1': FABLE_51_PRICE,
  'claude-fable-5': FABLE_PRICE,
  'claude-opus-5': OPUS_PRICE,
  'claude-opus-4-8': OPUS_PRICE,
  'claude-opus-4-7': OPUS_PRICE,
  'claude-opus-4-6': OPUS_PRICE,
  'claude-sonnet-5': SONNET_5_PRICE,
  'claude-sonnet-4-6': SONNET_PRICE,
  'claude-sonnet-4-5': SONNET_PRICE,
  'claude-haiku-4-5': {
    inputPerMtok: 1,
    outputPerMtok: 5,
    cachedInputPerMtok: 0.1,
  },
};

const FALLBACK: ModelPrice = CLAUDE_PRICES['claude-sonnet-4-6']!;

export const priceFor = (model: string): ModelPrice => {
  return CLAUDE_PRICES[model] ?? FALLBACK;
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
};

export const computeCostUsd = ({ usage, model }: Params): number => {
  const price = priceFor(model);
  return (
    (usage.inputTokens * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    ((usage.cacheCreationInputTokens ?? 0) * price.inputPerMtok * 1.25) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
};
