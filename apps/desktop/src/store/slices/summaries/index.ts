import { loadArchivedSessions } from './loadArchivedSessions';
import type { SliceDeps } from '../../slice-types';

export const createSummariesSlice = ({ set }: SliceDeps) => {
  return {
    loadArchivedSessions: loadArchivedSessions(set),
  };
};
