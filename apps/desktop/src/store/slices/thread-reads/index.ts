import { loadThreadReads } from './loadThreadReads';
import { markThreadsRead } from './markThreadsRead';
import type { SliceDeps } from '../../slice-types';

export const createThreadReadsSlice = ({ set, get }: SliceDeps) => ({
  loadThreadReads: loadThreadReads({ set, get }),
  markThreadsRead: markThreadsRead({ set, get }),
});
