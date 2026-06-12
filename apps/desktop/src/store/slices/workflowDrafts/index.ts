import { clearWorkflowDraft } from './clearWorkflowDraft';
import { setWorkflowDraft } from './setWorkflowDraft';
import type { GetFn, SetFn } from './types';

export const createWorkflowDraftsSlice = (set: SetFn, _get: GetFn) => {
  return {
    setWorkflowDraft: setWorkflowDraft(set),
    clearWorkflowDraft: clearWorkflowDraft(set),
  };
};
