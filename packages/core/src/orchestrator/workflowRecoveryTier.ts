import type { ModelCostTier, WorkflowModelPick } from '@goodboy/types';
import { catalogModelForId } from '../providers/catalogModelForId';

export const WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT: ModelCostTier = 'mid';

type Params = {
  readonly pick: WorkflowModelPick | null;
};

export const workflowRecoveryTier = ({ pick }: Params): ModelCostTier => {
  if (pick === null) {
    return WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT;
  }
  const model = catalogModelForId({ provider: pick.provider, modelId: pick.model });
  if (model === null) {
    return WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT;
  }
  return model.presentation.costTier;
};
