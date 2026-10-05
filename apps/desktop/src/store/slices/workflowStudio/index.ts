import { clearWorkflowStudioDraft } from './clearWorkflowStudioDraft';
import { consumeWorkflowGeneration } from './consumeWorkflowGeneration';
import { setWorkflowStudioDraft } from './setWorkflowStudioDraft';
import { setWorkflowStudioVisible } from './setWorkflowStudioVisible';
import { setWorkflowStudioFocus, setWorkflowStudioView } from './setWorkflowStudioFocus';
import { restoreWorkflowSnapshot } from './restoreWorkflowSnapshot';
import { startWorkflowGeneration } from './startWorkflowGeneration';
import { undoWorkflowGeneration } from './undoWorkflowGeneration';
import type { SliceDeps } from '../../slice-types';

export const createWorkflowStudioSlice = ({ set, get }: SliceDeps) => ({
  setWorkflowStudioDraft: setWorkflowStudioDraft(set),
  clearWorkflowStudioDraft: clearWorkflowStudioDraft(set),
  setWorkflowStudioVisible: setWorkflowStudioVisible(set),
  setWorkflowStudioFocus: setWorkflowStudioFocus(set),
  setWorkflowStudioView: setWorkflowStudioView(set),
  startWorkflowGeneration: startWorkflowGeneration(set, get),
  consumeWorkflowGeneration: consumeWorkflowGeneration(set),
  undoWorkflowGeneration: undoWorkflowGeneration(get),
  restoreWorkflowSnapshot: restoreWorkflowSnapshot(set, get),
});
