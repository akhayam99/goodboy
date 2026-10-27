import type { SessionViewPrefs, WorkspaceId } from '@goodboy/types';
import { readSessionViewPrefs } from './storage';
import type { GetFn, SetFn } from './types';

export const getSessionViewPrefs = (set: SetFn, get: GetFn) => {
  return (workspaceId: WorkspaceId): SessionViewPrefs => {
    const cached = get().sessionViewPrefs[workspaceId];
    if (cached) {
      return cached;
    }
    const prefs = readSessionViewPrefs({ workspaceId });
    set((s) => ({
      sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: prefs },
    }));
    return prefs;
  };
};
