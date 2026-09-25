import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';

type OpenNotificationSessionParams = {
  readonly notification: Notification;
};

export const openNotificationSession = ({
  notification,
}: OpenNotificationSessionParams): boolean => {
  const { sessionId, workspaceId } = notification;
  if (sessionId == null) {
    return false;
  }
  const agentId =
    notification.action?.kind === 'retry-step-summary' ? notification.action.agentId : null;
  void (async () => {
    const store = useAppStore.getState();
    if (workspaceId != null && workspaceId !== store.currentWorkspaceId) {
      await store.setCurrentWorkspace(workspaceId);
    }
    const state = useAppStore.getState();
    if (!state.sessions.some((candidate) => candidate.id === sessionId)) {
      return;
    }
    if (state.currentSessionId === sessionId) {
      state.setActiveLens(sessionId, null);
    }
    if (state.currentSessionId !== sessionId) {
      await state.setCurrentSession(sessionId);
    }
    if (agentId == null) {
      return;
    }
    await useAppStore.getState().selectAgent(sessionId, agentId);
  })().catch((error: unknown) => {
    void useAppStore.getState().reportError({ title: "Couldn't open this notification", error });
  });
  return true;
};
