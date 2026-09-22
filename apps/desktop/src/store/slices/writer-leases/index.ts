import { refreshStrandedWriterLeases } from './refreshStrandedWriterLeases';
import { releaseStrandedWriterLease } from './releaseStrandedWriterLease';
import type { GetFn, SetFn } from './types';

export const createWriterLeasesSlice = (set: SetFn, get: GetFn) => {
  return {
    strandedWriterLeases: [],
    refreshStrandedWriterLeases: refreshStrandedWriterLeases({ set, get }),
    releaseStrandedWriterLease: releaseStrandedWriterLease({ set, get }),
  };
};
