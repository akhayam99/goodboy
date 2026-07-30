import type { CodexModelPriceOverride, GeminiModelPriceOverride } from '@goodboy/core';
import shippedPricing from './pricing.json';

type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
};

export type PricingTable = {
  readonly version: string;
  readonly anthropic: Record<string, ModelPrice>;
  readonly codex: Record<string, ModelPrice>;
  readonly gemini: Record<string, ModelPrice>;
};

type PricingWindow = Window & {
  __DEV_PRICING_OVERRIDE__?: Partial<PricingTable>;
};

type PriceParams = {
  readonly provider: 'anthropic' | 'codex' | 'gemini';
  readonly model: string;
};

const activeTable: PricingTable = shippedPricing;

export const getActivePricingTable = (): PricingTable => {
  return activeTable;
};

const IS_DEV = import.meta.env.DEV === true;

const priceForModel = ({ provider, model }: PriceParams): ModelPrice | null => {
  const pricingWindow = typeof window === 'undefined' ? null : (window as PricingWindow);
  const table: PricingTable =
    IS_DEV && pricingWindow?.__DEV_PRICING_OVERRIDE__ != null
      ? { ...activeTable, ...pricingWindow.__DEV_PRICING_OVERRIDE__ }
      : activeTable;

  return table[provider][model] ?? null;
};

export const getCodexPriceOverride = (
  _config: unknown,
  model: string,
): CodexModelPriceOverride | null => {
  const price = priceForModel({ provider: 'codex', model });
  if (price === null) {
    return null;
  }
  return {
    inputPerMtok: price.inputPerMtok,
    outputPerMtok: price.outputPerMtok,
    ...(price.cachedInputPerMtok !== undefined
      ? { cachedInputPerMtok: price.cachedInputPerMtok }
      : {}),
  };
};

export const getGeminiPriceOverride = (
  _config: unknown,
  model: string,
): GeminiModelPriceOverride | null => {
  const price = priceForModel({ provider: 'gemini', model });
  if (price === null) {
    return null;
  }
  return {
    inputPerMtok: price.inputPerMtok,
    outputPerMtok: price.outputPerMtok,
    ...(price.cachedInputPerMtok !== undefined
      ? { cachedInputPerMtok: price.cachedInputPerMtok }
      : {}),
  };
};
