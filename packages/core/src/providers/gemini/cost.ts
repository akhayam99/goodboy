import type { ModelPrice, ProviderUsage } from '@goodboy/types';
import { computeLeveledCostUsd } from '../priceLevels';

export const GEMINI_PRICES: Readonly<Record<string, ModelPrice>> = {
  'gemini-3.1-pro': {
    inputPerMtok: 2,
    outputPerMtok: 12,
    cachedInputPerMtok: 0.2,
    aboveLevel: {
      aboveInputTokens: 200_000,
      inputPerMtok: 4,
      outputPerMtok: 18,
    },
  },
  'gemini-3.8-flash': {
    inputPerMtok: 0.75,
    outputPerMtok: 3.75,
    cachedInputPerMtok: 0.075,
  },
  'gemini-3.7-flash': {
    inputPerMtok: 0.75,
    outputPerMtok: 3.75,
    cachedInputPerMtok: 0.075,
  },
  'gemini-3.6-flash': {
    inputPerMtok: 0.75,
    outputPerMtok: 3.75,
    cachedInputPerMtok: 0.075,
  },
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
  readonly override?: ModelPrice | null;
};

export const computeGeminiCostUsd = ({ usage, model, override }: Params): number => {
  const price = override ?? GEMINI_PRICES[model];
  if (price == null) {
    return 0;
  }

  return computeLeveledCostUsd({ usage, price, isCacheInInput: true });
};
