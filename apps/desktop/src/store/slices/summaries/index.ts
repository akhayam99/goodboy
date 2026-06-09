import { loadArchivedSessions } from './loadArchivedSessions';
import { refreshSessionSummary } from './refreshSessionSummary';
import { refreshSessions } from './refreshSessions';
import { refreshWorkspaceSummary } from './refreshWorkspaceSummary';
import type { GetFn, SetFn } from './types';

export const createSummariesSlice = (set: SetFn, _get: GetFn) => {
  return {
    refreshSessions: refreshSessions(set),
    loadArchivedSessions: loadArchivedSessions(set),
    refreshSessionSummary: refreshSessionSummary(set),
    refreshWorkspaceSummary: refreshWorkspaceSummary(set),
  };
};
