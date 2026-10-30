import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'workspaceOverrides'>;
  readonly workspaceId: WorkspaceId;
};

export const workspaceGuidanceOf = ({ state, workspaceId }: Params): string =>
  state.workspaceOverrides?.[workspaceId]?.workflowRules?.standingGuidance ??
  DEFAULT_WORKFLOW_RULES.standingGuidance;
