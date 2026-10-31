import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import type { AppStore } from '../../../store';

type Params = {
  readonly state: Pick<AppStore, 'workspaceOverrides'>;
  readonly workspaceId: WorkspaceId;
};

export const workspaceRulesFor = ({ state, workspaceId }: Params): WorkflowRules => {
  const overrides = state.workspaceOverrides?.[workspaceId];
  if (overrides === undefined) {
    return { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false };
  }
  return overrides.workflowRules ?? DEFAULT_WORKFLOW_RULES;
};
