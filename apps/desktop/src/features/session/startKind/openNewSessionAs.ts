import type { WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { StartKind, StartShape } from '../../../store/slices/sessionDraft/state';

type Params = {
  readonly startKind: StartKind;
  readonly startShape?: StartShape | null;
  readonly presetId?: WorkflowId | null;
};

export const openNewSessionAs = ({
  startKind,
  startShape = null,
  presetId = null,
}: Params): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId !== null) {
    state.patchSessionDraft({
      workspaceId,
      patch: {
        startKind,
        startShape,
        hasChosenStart: true,
        ...(presetId !== null && { workflowId: presetId }),
      },
    });
  }
  state.openSessionDraft();
};
