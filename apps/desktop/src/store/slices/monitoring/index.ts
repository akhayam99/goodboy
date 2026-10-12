import { hidePort } from './hidePort';
import { loadWatchedPorts } from './loadWatchedPorts';
import { pinPort } from './pinPort';
import { refreshMonitorSnapshot } from './refreshMonitorSnapshot';
import { recordOrphansSwept } from './recordOrphansSwept';
import { showHiddenPorts } from './showHiddenPorts';
import { stopGoodboyRow } from './stopGoodboyRow';
import { stopLeftovers } from './stopLeftovers';
import { stopProcess } from './stopProcess';
import { unhidePort } from './unhidePort';
import { unpinPort } from './unpinPort';
import type { SliceDeps } from '../../slice-types';

export const createMonitoringSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshMonitorSnapshot: refreshMonitorSnapshot(set, get),
    loadWatchedPorts: loadWatchedPorts(set, get),
    pinPort: pinPort({ set, get }),
    unpinPort: unpinPort({ set, get }),
    hidePort: hidePort({ set, get }),
    unhidePort: unhidePort({ set, get }),
    showHiddenPorts: showHiddenPorts({ set, get }),
    stopProcess: stopProcess(set, get),
    stopGoodboyRow: stopGoodboyRow(set, get),
    stopLeftovers: stopLeftovers(get),
    recordOrphansSwept: recordOrphansSwept(set),
  };
};
