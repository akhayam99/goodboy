import { invokeWorkspacesWithUnread } from '../../features/phases/phases';
import type { TurnState, ProviderId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export function createSidebarSlice(set: SetFn, _get: GetFn) {
  return {
    setSidebarWorkspaceSearch: (query: string) => set({ sidebarWorkspaceSearch: query }),

    setSidebarSessionSearch: (query: string) => set({ sidebarSessionSearch: query }),

    refreshUnreadWorkspaces: async () => {
      try {
        const ids = await invokeWorkspacesWithUnread();
        set({ unreadWorkspaceIds: new Set(ids) });
      } catch {
        // Best-effort: stale unread indicators are recoverable from the next
        // selectAgent / status update.
      }
    },

    setSidebarStateFilter: (states: ReadonlyArray<TurnState['kind']>) =>
      set({ sidebarStateFilter: states }),

    setSidebarProviderFilter: (providers: ReadonlyArray<ProviderId>) =>
      set({ sidebarProviderFilter: providers }),
  };
}
