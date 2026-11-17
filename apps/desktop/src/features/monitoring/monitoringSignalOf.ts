import type { AppStore } from '../../store/store';
import { selectPortRows } from '../../store/slices/monitoring/selectPortRows';
import { monitoringSignal, type MonitoringSignal } from './monitoringSignal';
import { splitPortRows } from './splitPortRows';
import { workspacePortSet } from './workspacePortSet';

type Params = {
  readonly state: Parameters<typeof selectPortRows>[0] &
    Pick<AppStore, 'monitorPinned' | 'monitorHidden'>;
};

export const monitoringSignalOf = ({ state }: Params): MonitoringSignal | null => {
  if (state.monitorSnapshot === null) {
    return null;
  }
  return monitoringSignal({
    split: splitPortRows({
      rows: selectPortRows(state),
      pinned: state.monitorPinned,
      hidden: state.monitorHidden,
      workspacePorts: workspacePortSet({ scanned: state.monitorScanned }),
    }),
  });
};
