import type { ModelPrice, ModelPriceLevel, ProviderUsage, RequestUsage } from '@goodboy/types';

export const LARGE_REQUEST_MIN_PROMPT_TOKENS = 100_000;

const CACHE_WRITE_FACTOR = 1.25;

type RequestParams = {
  readonly request: RequestUsage;
  readonly price: ModelPrice;
  readonly isCacheInInput: boolean;
  readonly canUseLevel: boolean;
  readonly longCacheWriteFactor: number;
};

type UsageParams = {
  readonly usage: ProviderUsage;
  readonly price: ModelPrice;
  readonly isCacheInInput: boolean;
  readonly longCacheWriteFactor?: number;
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
  longCacheWriteFactor,
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
  const longWrites = Math.min(
    request.cacheCreationInputTokens,
    request.longCacheWriteInputTokens ?? 0,
  );
  const cacheWriteInputEquivalent =
    (request.cacheCreationInputTokens - longWrites) * CACHE_WRITE_FACTOR +
    longWrites * longCacheWriteFactor;
  return (
    (billableInput * rates.inputPerMtok) / 1_000_000 +
    (request.cachedInputTokens * (rates.cachedInputPerMtok ?? rates.inputPerMtok)) / 1_000_000 +
    (cacheWriteInputEquivalent * rates.inputPerMtok) / 1_000_000 +
    (request.outputTokens * rates.outputPerMtok) / 1_000_000
  );
};

export const computeLeveledCostUsd = ({
  usage,
  price,
  isCacheInInput,
  longCacheWriteFactor = CACHE_WRITE_FACTOR,
}: UsageParams): number => {
  const large = usage.largeRequests ?? [];
  const total: RequestUsage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
    longCacheWriteInputTokens: usage.longCacheWriteInputTokens ?? 0,
  };
  const turn = { price, isCacheInInput, longCacheWriteFactor };
  if (price.aboveLevel === undefined || large.length === 0) {
    return computeRequestCostUsd({ ...turn, request: total, canUseLevel: false });
  }
  let rest = total;
  let leveled = 0;
  for (const request of large) {
    leveled += computeRequestCostUsd({ ...turn, request, canUseLevel: true });
    rest = {
      inputTokens: Math.max(0, rest.inputTokens - request.inputTokens),
      outputTokens: Math.max(0, rest.outputTokens - request.outputTokens),
      cachedInputTokens: Math.max(0, rest.cachedInputTokens - request.cachedInputTokens),
      cacheCreationInputTokens: Math.max(
        0,
        rest.cacheCreationInputTokens - request.cacheCreationInputTokens,
      ),
      longCacheWriteInputTokens: Math.max(
        0,
        (rest.longCacheWriteInputTokens ?? 0) - (request.longCacheWriteInputTokens ?? 0),
      ),
    };
  }
  return leveled + computeRequestCostUsd({ ...turn, request: rest, canUseLevel: false });
};
