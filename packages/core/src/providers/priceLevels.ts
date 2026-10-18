import type { ModelPrice, ModelPriceLevel, ProviderUsage, RequestUsage } from '@goodboy/types';

export const LARGE_REQUEST_MIN_PROMPT_TOKENS = 100_000;

const CACHE_WRITE_FACTOR = 1.25;

type RequestParams = {
  readonly request: RequestUsage;
  readonly price: ModelPrice;
  readonly isCacheInInput: boolean;
  readonly canUseLevel: boolean;
};

type UsageParams = {
  readonly usage: ProviderUsage;
  readonly price: ModelPrice;
  readonly isCacheInInput: boolean;
};

type PromptParams = {
  readonly request: RequestUsage;
  readonly isCacheInInput: boolean;
};

export const requestPromptTokens = ({ request, isCacheInInput }: PromptParams): number => {
  const base = request.inputTokens + request.cacheCreationInputTokens;
  if (isCacheInInput) {
    return base;
  }
  return base + request.cachedInputTokens;
};

type LevelParams = {
  readonly price: ModelPrice;
  readonly level: ModelPriceLevel;
};

const levelRates = ({ price, level }: LevelParams): ModelPriceLevel => {
  if (level.cachedInputPerMtok !== undefined || price.cachedInputPerMtok === undefined) {
    return level;
  }
  return {
    ...level,
    cachedInputPerMtok: (price.cachedInputPerMtok * level.inputPerMtok) / price.inputPerMtok,
  };
};

const computeRequestCostUsd = ({
  request,
  price,
  isCacheInInput,
  canUseLevel,
}: RequestParams): number => {
  const level = price.aboveLevel;
  const isAboveLevel =
    canUseLevel &&
    level !== undefined &&
    requestPromptTokens({ request, isCacheInInput }) > level.aboveInputTokens;
  const rates = level !== undefined && isAboveLevel ? levelRates({ price, level }) : price;
  const billableInput = isCacheInInput
    ? Math.max(0, request.inputTokens - request.cachedInputTokens)
    : request.inputTokens;
  return (
    (billableInput * rates.inputPerMtok) / 1_000_000 +
    (request.cachedInputTokens * (rates.cachedInputPerMtok ?? rates.inputPerMtok)) / 1_000_000 +
    (request.cacheCreationInputTokens * rates.inputPerMtok * CACHE_WRITE_FACTOR) / 1_000_000 +
    (request.outputTokens * rates.outputPerMtok) / 1_000_000
  );
};

export const computeLeveledCostUsd = ({ usage, price, isCacheInInput }: UsageParams): number => {
  const large = usage.largeRequests ?? [];
  const total: RequestUsage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
  };
  if (price.aboveLevel === undefined || large.length === 0) {
    return computeRequestCostUsd({ request: total, price, isCacheInInput, canUseLevel: false });
  }
  let rest = total;
  let leveled = 0;
  for (const request of large) {
    leveled += computeRequestCostUsd({ request, price, isCacheInInput, canUseLevel: true });
    rest = {
      inputTokens: Math.max(0, rest.inputTokens - request.inputTokens),
      outputTokens: Math.max(0, rest.outputTokens - request.outputTokens),
      cachedInputTokens: Math.max(0, rest.cachedInputTokens - request.cachedInputTokens),
      cacheCreationInputTokens: Math.max(
        0,
        rest.cacheCreationInputTokens - request.cacheCreationInputTokens,
      ),
    };
  }
  return (
    leveled + computeRequestCostUsd({ request: rest, price, isCacheInInput, canUseLevel: false })
  );
};
