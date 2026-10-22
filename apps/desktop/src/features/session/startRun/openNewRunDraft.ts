import { useAppStore } from '../../../store';

type Params = {
  readonly text: string;
};

export const openNewRunDraft = ({ text }: Params): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId !== null) {
    state.patchSessionDraft({ workspaceId, patch: { workflowGoal: text } });
  }
  state.openSessionDraft();
};
