import type { ModelPrice, ModelPriceLevel, ProviderUsage } from '@goodboy/types';
import { computeLeveledCostUsd } from '../priceLevels';

const LONG_PROMPT_TOKENS = 272_000;

type LevelParams = Omit<ModelPriceLevel, 'aboveInputTokens'>;

const aboveLevel = ({
  inputPerMtok,
  outputPerMtok,
  cachedInputPerMtok,
}: LevelParams): ModelPriceLevel => ({
  aboveInputTokens: LONG_PROMPT_TOKENS,
  inputPerMtok,
  outputPerMtok,
  ...(cachedInputPerMtok !== undefined && { cachedInputPerMtok }),
});

export const CODEX_PRICES: Readonly<Record<string, ModelPrice>> = {
  'gpt-6-astra': {
    inputPerMtok: 10,
    outputPerMtok: 50,
    cachedInputPerMtok: 1,
    aboveLevel: aboveLevel({ inputPerMtok: 20, outputPerMtok: 75, cachedInputPerMtok: 2 }),
  },
  'gpt-6.1-sol': {
    inputPerMtok: 2,
    outputPerMtok: 10,
    cachedInputPerMtok: 0.1,
    aboveLevel: aboveLevel({ inputPerMtok: 4, outputPerMtok: 15, cachedInputPerMtok: 0.2 }),
  },
  'gpt-6-sol': {
    inputPerMtok: 2,
    outputPerMtok: 10,
    cachedInputPerMtok: 0.2,
    aboveLevel: aboveLevel({ inputPerMtok: 4, outputPerMtok: 15, cachedInputPerMtok: 0.4 }),
  },
  'gpt-6-luna': {
    inputPerMtok: 0.1,
    outputPerMtok: 0.5,
    cachedInputPerMtok: 0.01,
    aboveLevel: aboveLevel({ inputPerMtok: 0.2, outputPerMtok: 0.75 }),
  },
  'gpt-5.6-sol': {
    inputPerMtok: 4,
    outputPerMtok: 20,
    cachedInputPerMtok: 0.4,
    aboveLevel: aboveLevel({ inputPerMtok: 8, outputPerMtok: 30 }),
  },
  'gpt-5.6-terra': {
    inputPerMtok: 2,
    outputPerMtok: 12,
    cachedInputPerMtok: 0.2,
    aboveLevel: aboveLevel({ inputPerMtok: 4, outputPerMtok: 18 }),
  },
  'gpt-5.6-luna': {
    inputPerMtok: 0.2,
    outputPerMtok: 1.2,
    cachedInputPerMtok: 0.02,
    aboveLevel: aboveLevel({ inputPerMtok: 0.4, outputPerMtok: 1.8 }),
  },
  'gpt-5.5': {
    inputPerMtok: 5,
    outputPerMtok: 30,
    cachedInputPerMtok: 0.5,
  },
};

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
  readonly override?: ModelPrice | null;
};

export const computeCodexCostUsd = ({ usage, model, override }: Params): number => {
  const price = override ?? CODEX_PRICES[model];
  if (price == null) {
    return 0;
  }
  return computeLeveledCostUsd({ usage, price, isCacheInInput: true });
};
