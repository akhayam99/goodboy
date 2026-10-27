import type { WorkflowStudioState } from './types';

export const workflowStudioInitialState: WorkflowStudioState = {
  workflowStudioDrafts: {},
  workflowGenerations: {},
  visibleWorkflowStudioWorkspaceId: null,
  workflowStudioFocus: null,
  workflowStudioView: 'workflows',
  workflowRunHistory: {},
};
