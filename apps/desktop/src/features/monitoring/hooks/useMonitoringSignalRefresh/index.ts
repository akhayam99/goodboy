import { useCallback, useEffect } from 'react';
import { usePoll } from '../../../../shared/lib/usePoll';
import { useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { signalPorts } from '../../signalPorts';
import { splitPortRows } from '../../splitPortRows';
import { workspacePortSet } from '../../workspacePortSet';

const SIGNAL_INTERVAL_MS = 30_000;
const FRESH_MS = SIGNAL_INTERVAL_MS / 2;

type Params = {
  readonly isReady: boolean;
};

export const useMonitoringSignalRefresh = ({ isReady }: Params): void => {
  const refreshMonitorPorts = useAppStore((state) => state.refreshMonitorPorts);
  const loadWatchedPorts = useAppStore((state) => state.loadWatchedPorts);

  const tick = useCallback((): void => {
    const state = useAppStore.getState();
    const known = state.monitorSnapshot;
    if (known !== null && Date.now() - known.takenAt < FRESH_MS) {
      return;
    }
    const ports = signalPorts({
      split: splitPortRows({
        rows: selectPortRows(state),
        pinned: state.monitorPinned,
        hidden: state.monitorHidden,
        workspacePorts: workspacePortSet({ scanned: state.monitorScanned }),
      }),
      pinned: state.monitorPinned,
      learned: state.monitorLearned,
    });
    if (ports.length === 0) {
      return;
    }
    void refreshMonitorPorts({ ports });
  }, [refreshMonitorPorts]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void loadWatchedPorts().then(tick);
  }, [isReady, loadWatchedPorts, tick]);

  usePoll({ run: tick, everyMs: SIGNAL_INTERVAL_MS, isEnabled: isReady, isImmediate: false });
};
