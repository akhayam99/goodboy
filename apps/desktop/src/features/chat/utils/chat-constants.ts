import type { EffortLevel, ModelCostTier, ProviderId } from '@goodboy/types';
import { getModelDescriptor, getProviderModelPrice } from '@goodboy/core';

export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Very high',
  max: 'Max',
};

const FALLBACK_WEIGHT = 10;

export const TIER_TEXT: Record<ModelCostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

export const modelLabel = (id: string): string => getModelDescriptor(id)?.label ?? id;

export const modelTier = (model: string): ModelCostTier => {
  const descriptor = getModelDescriptor(model);
  if (descriptor) {
    return descriptor.costTier;
  }
  if (/haiku|small|mini|flash|nano|fast/i.test(model)) {
    return 'cheap';
  }
  if (/opus|max/i.test(model)) {
    return 'expensive';
  }
  return 'mid';
};

const modelWeight = (model: string): number => {
  return getModelDescriptor(model)?.weight ?? FALLBACK_WEIGHT;
};

const TIER_RANK: Record<ModelCostTier, number> = { cheap: 0, mid: 1, expensive: 2 };

export type ModelSuggestion = {
  readonly id: string;
  readonly kind: 'strong' | 'optional';
  readonly costMultiplier: number | null;
};

type CostRatioParams = {
  readonly provider: ProviderId;
  readonly numerator: string;
  readonly denominator: string;
};

const costRatio = ({ provider, numerator, denominator }: CostRatioParams): number | null => {
  const a = getProviderModelPrice({ provider, model: numerator });
  const b = getProviderModelPrice({ provider, model: denominator });
  if (a === null || b === null) {
    return null;
  }
  const avg = (a.inputPerMtok / b.inputPerMtok + a.outputPerMtok / b.outputPerMtok) / 2;
  const rounded = Math.round(avg * 10) / 10;
  return rounded === 1 ? null : rounded;
};

type SuggestionParams = {
  readonly provider: ProviderId;
  readonly current: string;
  readonly candidates: ReadonlyArray<string>;
};

export const suggestLighterModel = ({
  provider,
  current,
  candidates,
}: SuggestionParams): ModelSuggestion | null => {
  const currentRank = TIER_RANK[modelTier(current)];
  let best: { id: string; weight: number } | null = null;
  for (const id of candidates) {
    if (id === current) {
      continue;
    }
    const rank = TIER_RANK[modelTier(id)];
    if (rank >= currentRank || rank === TIER_RANK.cheap) {
      continue;
    }
    const weight = modelWeight(id);
    if (best === null || weight > best.weight) {
      best = { id, weight };
    }
  }
  if (best === null) {
    return null;
  }
  return {
    id: best.id,
    kind: 'strong',
    costMultiplier: costRatio({ provider, numerator: current, denominator: best.id }),
  };
};

export const suggestHeavierModel = ({
  provider,
  current,
  candidates,
}: SuggestionParams): ModelSuggestion | null => {
  const currentRank = TIER_RANK[modelTier(current)];
  const currentWeight = modelWeight(current);
  let best: { id: string; rank: number; weight: number } | null = null;
  for (const id of candidates) {
    if (id === current) {
      continue;
    }
    const rank = TIER_RANK[modelTier(id)];
    const weight = modelWeight(id);
    if (rank < currentRank || weight <= currentWeight) {
      continue;
    }
    if (best === null || rank > best.rank || (rank === best.rank && weight > best.weight)) {
      best = { id, rank, weight };
    }
  }
  if (best === null) {
    return null;
  }
  const kind = modelTier(current) === 'expensive' ? 'optional' : 'strong';
  return {
    id: best.id,
    kind,
    costMultiplier: costRatio({ provider, numerator: best.id, denominator: current }),
  };
};
