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
  readonly cursor: Record<string, ModelPrice>;
  readonly codex: Record<string, ModelPrice>;
  readonly gemini: Record<string, ModelPrice>;
};

const activeTable: PricingTable = shippedPricing as PricingTable;

export const getActivePricingTable = (): PricingTable => {
  return activeTable;
};

declare global {
  interface Window {
    __DEV_PRICING_OVERRIDE__?: Partial<PricingTable>;
  }
}

const IS_DEV = import.meta.env.DEV === true;

function priceForModel(
  provider: 'anthropic' | 'cursor' | 'codex' | 'gemini',
  model: string,
): ModelPrice | null {
  const table: PricingTable =
    IS_DEV && typeof window !== 'undefined' && window.__DEV_PRICING_OVERRIDE__
      ? { ...activeTable, ...window.__DEV_PRICING_OVERRIDE__ }
      : activeTable;

  return table[provider][model] ?? null;
}

export const getCodexPriceOverride = (
  _config: unknown,
  model: string,
): CodexModelPriceOverride | null => {
  const price = priceForModel('codex', model);
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
  const price = priceForModel('gemini', model);
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
