import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { monitoringSignal } from '../../../../features/monitoring/monitoringSignal';
import { splitPortRows } from '../../../../features/monitoring/splitPortRows';
import { workspacePortSet } from '../../../../features/monitoring/workspacePortSet';
import { runningTerminalCount } from '../../../../features/terminal/runningTerminalCount';
import type { ColumnDoorId } from '../columnPlace';
import { doorSignalOf, type DoorSignal } from '../doorSignal';

type Params = Record<never, never>;

export const useDoorSignals = ({}: Params): Partial<Record<ColumnDoorId, DoorSignal>> => {
  const terminalTabs = useAppStore((state) => state.terminalTabs);
  const rows = useAppStore(selectPortRows);
  const hasSnapshot = useAppStore((state) => state.monitorSnapshot !== null);
  const scanned = useAppStore((state) => state.monitorScanned);
  const pinned = useAppStore((state) => state.monitorPinned);
  const hidden = useAppStore((state) => state.monitorHidden);

  return useMemo(() => {
    const split = splitPortRows({
      rows,
      pinned,
      hidden,
      workspacePorts: workspacePortSet({ scanned }),
    });
    return {
      terminal: doorSignalOf({
        kind: 'terminal',
        count: runningTerminalCount({ tabs: terminalTabs }),
      }),
      monitoring: hasSnapshot
        ? doorSignalOf({ kind: 'monitoring', ...monitoringSignal({ split }) })
        : undefined,
    };
  }, [terminalTabs, rows, hasSnapshot, scanned, pinned, hidden]);
};
