import type { ModelCostTier, WorkflowModelPick } from '@goodboy/types';
import { MODEL_CATALOGS } from '../providers/catalogs';

export const WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT: ModelCostTier = 'mid';

type Params = {
  readonly pick: WorkflowModelPick | null;
};

export const workflowRecoveryTier = ({ pick }: Params): ModelCostTier => {
  if (pick === null) {
    return WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT;
  }
  const model = MODEL_CATALOGS[pick.provider].find((candidate) => candidate.key === pick.model);
  if (model === undefined) {
    return WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT;
  }
  return model.presentation.costTier;
};
