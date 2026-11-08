import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { useAppStore } from '../../../../store';
import { selectOwnedMounts } from '../../../../store/slices/monitoring/selectOwnedMounts';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import type { MonitoringTarget } from '../../../monitoring/monitoringTarget';
import { runningHereOf, type RunningHereItem } from '../../../monitoring/runningHereOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: string | null;
  readonly branch: string | null;
  readonly isActive: boolean;
};

export type RunningHere = {
  readonly target: MonitoringTarget | null;
  readonly items: ReadonlyArray<RunningHereItem>;
};

export const useRunningHere = ({
  workspaceId,
  projectId,
  branch,
  isActive,
}: Params): RunningHere => {
  const isTargeted = projectId !== null && branch !== null && branch !== '';
  useMonitorPolling({ isEnabled: isActive && isTargeted });
  const rows = useAppStore(selectPortRows);
  const ledger = useAppStore((state) => state.monitorLedger);
  const mounts = useAppStore((state) => selectOwnedMounts({ state }));

  return useMemo(() => {
    if (!isTargeted) {
      return { target: null, items: [] };
    }
    const target = { workspaceId, projectId, branch };
    return { target, items: runningHereOf({ rows, ledger, mounts, target }) };
  }, [isTargeted, workspaceId, projectId, branch, rows, ledger, mounts]);
};
