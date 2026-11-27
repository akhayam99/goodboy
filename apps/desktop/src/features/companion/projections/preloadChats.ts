import type { AppStore } from '../../../store/store';

const attempted = new Set<string>();

type Params = {
  readonly state: AppStore;
};

export const preloadChats = ({ state }: Params): void => {
  for (const workspace of state.workspaces) {
    const workspaceId = workspace.id;
    if (attempted.has(workspaceId) || state.chatsByWorkspace[workspaceId] !== undefined) {
      continue;
    }
    attempted.add(workspaceId);
    void state
      .loadChats({ workspaceId })
      .catch((error: unknown) => console.error('[companion] chats failed', error));
  }
};
