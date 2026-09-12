import type { ModelCostTier } from '@goodboy/types';

export const MODEL_COST_RANK: Readonly<Record<ModelCostTier, number>> = {
  cheap: 1,
  mid: 2,
  expensive: 3,
};
