import { invokeWorkspacesWithUnread } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export const refreshUnreadWorkspaces = (set: SetFn) => {
  return async () => {
    try {
      const ids = await invokeWorkspacesWithUnread();
      set({ unreadWorkspaceIds: new Set(ids) });
    } catch {
      // Best-effort: stale unread indicators are recoverable from the next
      // selectAgent / status update.
    }
  };
};
