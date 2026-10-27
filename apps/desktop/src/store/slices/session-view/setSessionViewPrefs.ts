import type { SessionViewPrefs } from '@goodboy/types';
import { readSessionViewPrefs, writeSessionViewPrefs } from './storage';
import type { GetFn, SetFn, SetSessionViewPrefsParams } from './types';

export const setSessionViewPrefs = (set: SetFn, get: GetFn) => {
  return ({ workspaceId, patch }: SetSessionViewPrefsParams): void => {
    const current = get().sessionViewPrefs[workspaceId] ?? readSessionViewPrefs({ workspaceId });
    const next: SessionViewPrefs = { ...current, ...patch };
    writeSessionViewPrefs({ workspaceId, prefs: next });
    set((s) => ({
      sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
    }));
  };
};
