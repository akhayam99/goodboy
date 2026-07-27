import { getModelDescriptor } from '@goodboy/core';
import type { ModelMixEntry } from '@goodboy/db';
import type { ModelCostTier } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';

type TierSlice = {
  readonly tier: ModelCostTier;
  readonly label: string;
  readonly tone: Tone;
  readonly costUsd: number;
  readonly share: number;
};

export type TierMix = {
  readonly slices: ReadonlyArray<TierSlice>;
  readonly totalCostUsd: number;
  readonly topTierShare: number;
  readonly upkeepShare: number;
};

const TIER_ORDER: ReadonlyArray<ModelCostTier> = ['expensive', 'mid', 'cheap'];

const TIER_LABEL: Record<ModelCostTier, string> = {
  expensive: 'largest models',
  mid: 'mid models',
  cheap: 'small models',
};

const TIER_TONE: Record<ModelCostTier, Tone> = {
  expensive: 'primary',
  mid: 'info',
  cheap: 'neutral',
};

type Params = {
  readonly entries: ReadonlyArray<ModelMixEntry>;
};

export const tierMix = ({ entries }: Params): TierMix => {
  const costByTier = new Map<ModelCostTier, number>();
  let totalCostUsd = 0;
  let summarizerCostUsd = 0;

  for (const entry of entries) {
    const tier = getModelDescriptor(entry.model)?.costTier ?? 'mid';
    costByTier.set(tier, (costByTier.get(tier) ?? 0) + entry.costUsd);
    totalCostUsd += entry.costUsd;
    if (entry.kind === 'summarizer') {
      summarizerCostUsd += entry.costUsd;
    }
  }

  const slices = TIER_ORDER.filter((tier) => (costByTier.get(tier) ?? 0) > 0).map((tier) => {
    const costUsd = costByTier.get(tier) ?? 0;
    return {
      tier,
      label: TIER_LABEL[tier],
      tone: TIER_TONE[tier],
      costUsd,
      share: totalCostUsd > 0 ? (costUsd / totalCostUsd) * 100 : 0,
    };
  });

  return {
    slices,
    totalCostUsd,
    topTierShare: totalCostUsd > 0 ? ((costByTier.get('expensive') ?? 0) / totalCostUsd) * 100 : 0,
    upkeepShare: totalCostUsd > 0 ? (summarizerCostUsd / totalCostUsd) * 100 : 0,
  };
};
