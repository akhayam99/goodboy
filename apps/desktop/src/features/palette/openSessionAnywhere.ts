import { sessionPlace, useAppStore } from '../../store';
import type { SessionOpenParams } from './sources/sessionEntries';

export const openSessionAnywhere = ({ sessionId, workspaceId }: SessionOpenParams): void => {
  void (async () => {
    const store = useAppStore.getState();
    if (workspaceId !== store.currentWorkspaceId) {
      const workspace = store.workspaces.find((candidate) => candidate.id === workspaceId);
      await store.openWorkspace({
        id: workspaceId,
        title: workspace?.name ?? '',
        onRunning: 'new-window',
      });
    }
    const state = useAppStore.getState();
    if (!state.sessions.some((candidate) => candidate.id === sessionId)) {
      return;
    }
    state.navigate({ to: sessionPlace({ sessionId }) });
  })().catch((error: unknown) => {
    void useAppStore.getState().reportError({ title: "Couldn't open this session", error });
  });
};
