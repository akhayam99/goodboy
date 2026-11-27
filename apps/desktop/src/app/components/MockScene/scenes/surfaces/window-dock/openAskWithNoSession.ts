import { useAppStore } from '../../../../../../store';
import { WORKSPACE_ID } from '../../BoardScene';

export const openAskWithNoSession = (): void => {
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID });
  useAppStore.getState().openDrawer({ kind: 'ask', sessionId: null, payload: null });
};
