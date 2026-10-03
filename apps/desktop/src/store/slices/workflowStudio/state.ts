import type { WorkflowStudioState } from './types';

export const initialWorkflowStudioState: WorkflowStudioState = {
  workflowStudioDrafts: {},
  workflowGenerations: {},
  visibleWorkflowStudioWorkspaceId: null,
  workflowStudioFocus: null,
  workflowStudioView: 'workflows',
};
