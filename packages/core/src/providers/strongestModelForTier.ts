import type { ModelCostTier, ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { MODEL_COST_RANK } from './modelCostRank';

type Params = {
  readonly provider: ProviderId;
  readonly tier: ModelCostTier;
  readonly wantsThinker: boolean;
};

type ScoreParams = {
  readonly model: ModelDescriptor;
  readonly tier: ModelCostTier;
};

export const tierMatchScore = ({ model, tier }: ScoreParams): number => {
  return -Math.abs(MODEL_COST_RANK[model.costTier] - MODEL_COST_RANK[tier]) * 1000 + model.weight;
};

export const strongestModelForTier = ({
  provider,
  tier,
  wantsThinker,
}: Params): ModelDescriptor | null => {
  let best: ModelDescriptor | null = null;
  for (const model of PROVIDER_CAPABILITIES[provider].models) {
    if (model.thinkerOnly && !wantsThinker) {
      continue;
    }
    if (best === null || tierMatchScore({ model, tier }) > tierMatchScore({ model: best, tier })) {
      best = model;
    }
  }
  return best;
};
