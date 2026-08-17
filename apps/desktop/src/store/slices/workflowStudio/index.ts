import { clearWorkflowStudioDraft } from './clearWorkflowStudioDraft';
import { consumeWorkflowGeneration } from './consumeWorkflowGeneration';
import { setWorkflowStudioDraft } from './setWorkflowStudioDraft';
import { setWorkflowStudioVisible } from './setWorkflowStudioVisible';
import { startWorkflowGeneration } from './startWorkflowGeneration';
import { undoWorkflowGeneration } from './undoWorkflowGeneration';
import type { GetFn, SetFn } from './types';

export const createWorkflowStudioSlice = (set: SetFn, get: GetFn) => ({
  setWorkflowStudioDraft: setWorkflowStudioDraft(set),
  clearWorkflowStudioDraft: clearWorkflowStudioDraft(set),
  setWorkflowStudioVisible: setWorkflowStudioVisible(set),
  startWorkflowGeneration: startWorkflowGeneration(set, get),
  consumeWorkflowGeneration: consumeWorkflowGeneration(set),
  undoWorkflowGeneration: undoWorkflowGeneration(set, get),
});
