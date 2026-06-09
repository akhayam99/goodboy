import type { SessionSortKey, SessionViewPrefs, WorkspaceId } from '@goodboy/types';
import { readFromStorage, writeToStorage } from './storage';
import type { GetFn, SetFn } from './types';

export const setSessionSort = (set: SetFn, get: GetFn) => {
  return (workspaceId: WorkspaceId, sort: SessionSortKey): void => {
    const current = get().sessionViewPrefs[workspaceId] ?? readFromStorage(workspaceId);
    const next: SessionViewPrefs = { ...current, sort };
    writeToStorage(workspaceId, next);
    set((s) => ({
      sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
    }));
  };
};
