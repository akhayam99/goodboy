import type { ModelPrice, ProviderUsage } from '@goodboy/types';

export const GEMINI_PRICES: Readonly<Record<string, ModelPrice>> = {
  'gemini-3.1-pro': {
    inputPerMtok: 2,
    outputPerMtok: 12,
    cachedInputPerMtok: 0.2,
  },
  'gemini-3.5-flash': {
    inputPerMtok: 1.5,
    outputPerMtok: 9,
    cachedInputPerMtok: 0.15,
  },
  'gemini-3.8-flash': {
    inputPerMtok: 1.5,
    outputPerMtok: 9,
    cachedInputPerMtok: 0.15,
    assumed: true,
  },
  'gemini-3.7-flash': {
    inputPerMtok: 1.5,
    outputPerMtok: 9,
    cachedInputPerMtok: 0.15,
    assumed: true,
  },
  'gemini-3.6-flash': {
    inputPerMtok: 1.5,
    outputPerMtok: 9,
    cachedInputPerMtok: 0.15,
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

  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * (price.cachedInputPerMtok ?? price.inputPerMtok)) / 1_000_000 +
    ((usage.cacheCreationInputTokens ?? 0) * price.inputPerMtok * 1.25) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  );
};
