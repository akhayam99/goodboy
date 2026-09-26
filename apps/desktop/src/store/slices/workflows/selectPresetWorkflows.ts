import type { Workflow, WorkspaceId } from '@goodboy/types';
import { isPresetWorkflow } from '../../../features/workflows/isPresetWorkflow';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'phaseTemplates'>;
  readonly workspaceId: WorkspaceId;
};

export const selectPresetWorkflows = ({ state, workspaceId }: Params): ReadonlyArray<Workflow> =>
  (state.phaseTemplates[workspaceId] ?? []).filter(isPresetWorkflow);
