import type { ModelCostTier, ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { MODEL_COST_RANK } from './modelCostRank';
import { isModelHidden, type HiddenModels } from './modelVisibility';

type Params = {
  readonly provider: ProviderId;
  readonly tier: ModelCostTier;
  readonly wantsThinker: boolean;
  readonly hidden?: HiddenModels;
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
  hidden,
}: Params): ModelDescriptor | null => {
  let best: ModelDescriptor | null = null;
  for (const model of PROVIDER_CAPABILITIES[provider].models) {
    if (model.thinkerOnly && !wantsThinker) {
      continue;
    }
    if (hidden != null && isModelHidden({ provider, hidden, key: model.id })) {
      continue;
    }
    if (best === null || tierMatchScore({ model, tier }) > tierMatchScore({ model: best, tier })) {
      best = model;
    }
  }
  return best;
};
