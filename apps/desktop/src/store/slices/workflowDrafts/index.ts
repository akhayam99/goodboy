import { clearWorkflowDraft } from './clearWorkflowDraft';
import { setWorkflowDraft } from './setWorkflowDraft';
import type { SliceDeps } from '../../slice-types';

export const createWorkflowDraftsSlice = ({ set }: SliceDeps) => {
  return {
    setWorkflowDraft: setWorkflowDraft(set),
    clearWorkflowDraft: clearWorkflowDraft(set),
  };
};
