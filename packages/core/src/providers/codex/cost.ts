import type { ProviderUsage } from '@goodboy/types';

export type CodexModelPriceOverride = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
};

export const CODEX_PRICES: Readonly<Record<string, CodexModelPriceOverride>> = {
  'gpt-5.6-sol': {
    inputPerMtok: 5,
    outputPerMtok: 30,
    cachedInputPerMtok: 0.5,
  },
  'gpt-5.6-terra': {
    inputPerMtok: 2.5,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.25,
  },
  'gpt-5.6-luna': {
    inputPerMtok: 1,
    outputPerMtok: 6,
    cachedInputPerMtok: 0.1,
  },
  'gpt-5.5': {
    inputPerMtok: 5,
    outputPerMtok: 30,
    cachedInputPerMtok: 0.5,
  },
  'gpt-5.4': {
    inputPerMtok: 2.5,
    outputPerMtok: 15,
    cachedInputPerMtok: 0.25,
  },
  'gpt-5.4-mini': {
    inputPerMtok: 0.75,
    outputPerMtok: 4.5,
    cachedInputPerMtok: 0.075,
  },
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
  readonly override?: CodexModelPriceOverride | null;
};

export const computeCodexCostUsd = ({ usage, model, override }: Params): number => {
  const price = override ?? CODEX_PRICES[model];
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
