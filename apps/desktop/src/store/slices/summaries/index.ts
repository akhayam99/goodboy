import { loadArchivedSessions } from './loadArchivedSessions';
import type { GetFn, SetFn } from './types';

export const createSummariesSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadArchivedSessions: loadArchivedSessions(set),
  };
};
