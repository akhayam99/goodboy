import { loadWatchedPorts } from './loadWatchedPorts';
import { refreshMonitorSnapshot } from './refreshMonitorSnapshot';
import { recordOrphansSwept } from './recordOrphansSwept';
import { stopGoodboyRow } from './stopGoodboyRow';
import { stopLeftovers } from './stopLeftovers';
import { stopProcess } from './stopProcess';
import { unwatchPort } from './unwatchPort';
import { watchPort } from './watchPort';
import type { SliceDeps } from '../../slice-types';

export const createMonitoringSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshMonitorSnapshot: refreshMonitorSnapshot(set, get),
    loadWatchedPorts: loadWatchedPorts(set, get),
    watchPort: watchPort(set, get),
    unwatchPort: unwatchPort(set, get),
    stopProcess: stopProcess(set, get),
    stopGoodboyRow: stopGoodboyRow(set, get),
    stopLeftovers: stopLeftovers(get),
    recordOrphansSwept: recordOrphansSwept(set),
  };
};
