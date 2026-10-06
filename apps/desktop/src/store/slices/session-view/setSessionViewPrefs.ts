import type { SessionViewPrefs } from '@goodboy/types';
import { readFromStorage, writeToStorage } from './storage';
import type { GetFn, SetFn, SetSessionViewPrefsParams } from './types';

export const setSessionViewPrefs = (set: SetFn, get: GetFn) => {
  return ({ workspaceId, patch }: SetSessionViewPrefsParams): void => {
    const current = get().sessionViewPrefs[workspaceId] ?? readFromStorage(workspaceId);
    const next: SessionViewPrefs = { ...current, ...patch };
    writeToStorage(workspaceId, next);
    set((s) => ({
      sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
    }));
  };
};
