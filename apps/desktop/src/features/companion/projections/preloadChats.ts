import type { AppStore } from '../../../store/store';

const attempted = new Set<string>();

type Params = {
  readonly state: AppStore;
};

export const preloadChats = ({ state }: Params): void => {
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null || attempted.has(workspaceId)) {
    return;
  }
  if (state.chatsByWorkspace[workspaceId] !== undefined) {
    return;
  }
  attempted.add(workspaceId);
  void state
    .loadChats({ workspaceId })
    .catch((error: unknown) => console.error('[companion] chats failed', error));
};
