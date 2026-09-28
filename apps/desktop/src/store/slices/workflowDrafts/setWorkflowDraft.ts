import type { SetFn, WorkflowBuilderDraft, WorkflowDraftKey } from './types';

export const setWorkflowDraft = (set: SetFn) => {
  return (draftKey: WorkflowDraftKey, draft: WorkflowBuilderDraft) => {
    set((s) => ({ workflowDrafts: { ...s.workflowDrafts, [draftKey]: draft } }));
  };
};
