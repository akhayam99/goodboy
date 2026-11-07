import { setMonitoringQuery } from './setMonitoringQuery';
import { setTerminalArchivedOpen } from './setTerminalArchivedOpen';
import { toggleMonitoringFold } from './toggleMonitoringFold';
import type { SliceDeps } from '../../slice-types';

export const createMonitoringViewSlice = ({ set }: SliceDeps) => {
  return {
    setMonitoringQuery: setMonitoringQuery({ set }),
    toggleMonitoringFold: toggleMonitoringFold({ set }),
    setTerminalArchivedOpen: setTerminalArchivedOpen({ set }),
  };
};
