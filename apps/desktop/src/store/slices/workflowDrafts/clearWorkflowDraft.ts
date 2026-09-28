import type { SetFn, WorkflowDraftKey } from './types';

export const clearWorkflowDraft = (set: SetFn) => {
  return (draftKey: WorkflowDraftKey) => {
    set((s) => {
      if (!(draftKey in s.workflowDrafts)) {
        return s;
      }
      const next = { ...s.workflowDrafts };
      delete next[draftKey];
      return { workflowDrafts: next };
    });
  };
};
