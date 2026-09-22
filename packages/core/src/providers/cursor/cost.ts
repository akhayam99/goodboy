import type { ProviderUsage } from '@goodboy/types';

type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok: number;
};

const COMPOSER_PRICE: ModelPrice = {
  inputPerMtok: 0.5,
  outputPerMtok: 2.5,
  cachedInputPerMtok: 0.2,
};
const COMPOSER_FAST_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.5,
};
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const SONNET5_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 10,
  cachedInputPerMtok: 0.2,
};
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 25,
  cachedInputPerMtok: 0.5,
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
const GPT56_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 30,
  cachedInputPerMtok: 0.5,
};
const TERRA_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 12,
  cachedInputPerMtok: 0.2,
};
const LUNA_PRICE: ModelPrice = {
  inputPerMtok: 0.2,
  outputPerMtok: 1.2,
  cachedInputPerMtok: 0.02,
};
const GPT54_PRICE: ModelPrice = {
  inputPerMtok: 2.5,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.25,
};
const GROK_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 6,
  cachedInputPerMtok: 0.5,
};
const GROK_FAST_PRICE: ModelPrice = {
  inputPerMtok: 4,
  outputPerMtok: 12,
  cachedInputPerMtok: 1,
};
const GEMINI_FLASH_PRICE: ModelPrice = {
  inputPerMtok: 0.75,
  outputPerMtok: 3.5,
  cachedInputPerMtok: 0.075,
};
const GEMINI_PRO_PRICE: ModelPrice = {
  inputPerMtok: 2,
  outputPerMtok: 12,
  cachedInputPerMtok: 0.2,
};
const MUSE_SPARK_PRICE: ModelPrice = {
  inputPerMtok: 1.25,
  outputPerMtok: 4.25,
  cachedInputPerMtok: 0.15,
};
const KIMI_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
};
const GLM_PRICE: ModelPrice = {
  inputPerMtok: 1.4,
  outputPerMtok: 4.4,
  cachedInputPerMtok: 0.26,
};

export const CURSOR_PRICES: Record<string, ModelPrice> = {
  'composer-2.5-fast': COMPOSER_FAST_PRICE,
  'composer-2.5': COMPOSER_PRICE,
  auto: COMPOSER_PRICE,

  'claude-opus-5-5-low': OPUS_PRICE,
  'claude-opus-5-5-medium': OPUS_PRICE,
  'claude-opus-5-5-high': OPUS_PRICE,
  'claude-opus-5-5-xhigh': OPUS_PRICE,
  'claude-opus-5-5-max': OPUS_PRICE,
  'claude-opus-5-thinking-high': OPUS_PRICE,
  'claude-opus-5-low': OPUS_PRICE,
  'claude-opus-4-8-thinking-high': OPUS_PRICE,
  'claude-opus-4-7-thinking-high': OPUS_PRICE,
  'claude-fable-5-1-thinking-low': FABLE_51_PRICE,
  'claude-fable-5-1-thinking-medium': FABLE_51_PRICE,
  'claude-fable-5-1-thinking-high': FABLE_51_PRICE,
  'claude-fable-5-1-thinking-xhigh': FABLE_51_PRICE,
  'claude-fable-5-1-thinking-max': FABLE_51_PRICE,
  'claude-fable-5-thinking-low': FABLE_PRICE,
  'claude-fable-5-thinking-medium': FABLE_PRICE,
  'claude-fable-5-thinking-high': FABLE_PRICE,
  'claude-fable-5-thinking-xhigh': FABLE_PRICE,
  'claude-fable-5-thinking-max': FABLE_PRICE,
  'claude-sonnet-5-high': SONNET5_PRICE,
  'claude-sonnet-5-xhigh': SONNET5_PRICE,
  'claude-sonnet-5-thinking-high': SONNET5_PRICE,
  'claude-sonnet-5-thinking-xhigh': SONNET5_PRICE,
  'claude-4.6-sonnet-medium': SONNET_PRICE,
  'claude-4.6-sonnet-medium-thinking': SONNET_PRICE,

  'gpt-5.6-sol-high': GPT56_PRICE,
  'gpt-5.6-terra-high': TERRA_PRICE,
  'gpt-5.6-terra-xhigh': TERRA_PRICE,
  'gpt-5.6-luna-medium': LUNA_PRICE,
  'gpt-5.6-luna-high': LUNA_PRICE,
  'gpt-5.5-high': GPT56_PRICE,
  'gpt-5.5-medium': GPT56_PRICE,
  'gpt-5.3-codex': GPT54_PRICE,

  'grok-4.7-medium': GROK_PRICE,
  'grok-4.7-medium-fast': GROK_FAST_PRICE,
  'cursor-grok-4.6-medium': GROK_PRICE,
  'cursor-grok-4.6-medium-fast': GROK_FAST_PRICE,

  'gemini-3.1-pro': GEMINI_PRO_PRICE,
  'gemini-3.8-flash-low': GEMINI_FLASH_PRICE,
  'gemini-3.8-flash-medium': GEMINI_FLASH_PRICE,
  'gemini-3.8-flash-high': GEMINI_FLASH_PRICE,
  'gemini-3.7-flash-low': GEMINI_FLASH_PRICE,
  'gemini-3.7-flash-medium': GEMINI_FLASH_PRICE,
  'gemini-3.7-flash-high': GEMINI_FLASH_PRICE,
  'gemini-3.6-flash-low': GEMINI_FLASH_PRICE,
  'gemini-3.6-flash-medium': GEMINI_FLASH_PRICE,
  'gemini-3.6-flash-high': GEMINI_FLASH_PRICE,
  'gemini-3.5-flash': GEMINI_FLASH_PRICE,
  'gemini-3-flash': GEMINI_FLASH_PRICE,

  'muse-spark-1.3-low': MUSE_SPARK_PRICE,
  'muse-spark-1.3-medium': MUSE_SPARK_PRICE,
  'muse-spark-1.3-high': MUSE_SPARK_PRICE,
  'muse-spark-1.3-xhigh': MUSE_SPARK_PRICE,
  'muse-spark-1.3-max': MUSE_SPARK_PRICE,

  'kimi-k2.7-code': KIMI_PRICE,
  'kimi-k3-low': KIMI_PRICE,
  'kimi-k3-high': KIMI_PRICE,
  'kimi-k3-max': KIMI_PRICE,

  'glm-5.2-high': GLM_PRICE,
  'glm-5.2-max': GLM_PRICE,
};

const KNOWN_PRICES = Object.values(CURSOR_PRICES);

const FALLBACK: ModelPrice = {
  inputPerMtok: Math.max(...KNOWN_PRICES.map((price) => price.inputPerMtok)),
  outputPerMtok: Math.max(...KNOWN_PRICES.map((price) => price.outputPerMtok)),
  cachedInputPerMtok: Math.max(...KNOWN_PRICES.map((price) => price.cachedInputPerMtok)),
};

export const cursorPriceFor = (model: string): ModelPrice => {
  return CURSOR_PRICES[model] ?? FALLBACK;
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
};

export const computeCursorCostUsd = ({ usage, model }: Params): number => {
  const price = cursorPriceFor(model);
  return (
    (usage.inputTokens * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    ((usage.cacheCreationInputTokens ?? 0) * price.inputPerMtok * 1.25) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
};
