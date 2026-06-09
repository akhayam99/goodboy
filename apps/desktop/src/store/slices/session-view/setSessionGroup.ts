import type { SessionGroupKey, SessionViewPrefs, WorkspaceId } from '@goodboy/types';
import { readFromStorage, writeToStorage } from './storage';
import type { GetFn, SetFn } from './types';

export const setSessionGroup = (set: SetFn, get: GetFn) => {
  return (workspaceId: WorkspaceId, group: SessionGroupKey): void => {
    const current = get().sessionViewPrefs[workspaceId] ?? readFromStorage(workspaceId);
    const next: SessionViewPrefs = { ...current, group };
    writeToStorage(workspaceId, next);
    set((s) => ({
      sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
    }));
  };
};
