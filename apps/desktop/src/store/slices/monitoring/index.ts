import { loadWatchedPorts } from './loadWatchedPorts';
import { refreshMonitorSnapshot } from './refreshMonitorSnapshot';
import { unwatchPort } from './unwatchPort';
import { watchPort } from './watchPort';
import type { SliceDeps } from '../../slice-types';

export const createMonitoringSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshMonitorSnapshot: refreshMonitorSnapshot(set, get),
    loadWatchedPorts: loadWatchedPorts(set, get),
    watchPort: watchPort(set, get),
    unwatchPort: unwatchPort(set, get),
  };
};
