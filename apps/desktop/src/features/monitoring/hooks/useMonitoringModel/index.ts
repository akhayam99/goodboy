import { useMemo } from 'react';
import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { filterPortRows } from '../../filterPortRows';
import { isOnBranch } from '../../isOnBranch';
import { portSummary, type PortSummary } from '../../portSummary';
import { splitPortRows } from '../../splitPortRows';
import { startedByGoodboy, type StartedRow } from '../../startedByGoodboy';
import { unmatchedStarted } from '../../unmatchedStarted';
import { workspacePortSet } from '../../workspacePortSet';

type MonitoringStatus = 'loading' | 'failed' | 'unsupported' | 'ready';

export type MonitoringModel = {
  readonly status: MonitoringStatus;
  readonly error: string | null;
  readonly takenAt: number | null;
  readonly summary: PortSummary;
  readonly pinned: ReadonlyArray<PortRow>;
  readonly goodboy: ReadonlyArray<PortRow>;
  readonly workspace: ReadonlyArray<PortRow>;
  readonly listening: ReadonlyArray<PortRow>;
  readonly processes: ReadonlyArray<StartedRow>;
  readonly hiddenCount: number;
  readonly isTrackedEmpty: boolean;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly query: string;
  readonly branch: string | null;
  readonly isBranchEmpty: boolean;
};

const statusOf = ({
  hasSnapshot,
  isSupported,
  error,
}: {
  readonly hasSnapshot: boolean;
  readonly isSupported: boolean;
  readonly error: string | null;
}): MonitoringStatus => {
  if (!hasSnapshot) {
    return error === null ? 'loading' : 'failed';
  }
  return isSupported ? 'ready' : 'unsupported';
};

export const useMonitoringModel = (): MonitoringModel => {
  const snapshot = useAppStore((state) => state.monitorSnapshot);
  const ledger = useAppStore((state) => state.monitorLedger);
  const error = useAppStore((state) => state.monitorError);
  const rows = useAppStore(selectPortRows);
  const scanned = useAppStore((state) => state.monitorScanned);
  const pinned = useAppStore((state) => state.monitorPinned);
  const hidden = useAppStore((state) => state.monitorHidden);
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const query = useAppStore((state) => state.monitoringView.query);
  const branch = useAppStore((state) =>
    state.appStudio?.kind === 'monitoring' ? (state.appStudio.branch ?? null) : null,
  );

  return useMemo(() => {
    const split = splitPortRows({
      rows,
      pinned,
      hidden,
      workspacePorts: workspacePortSet({ scanned }),
    });
    const projectNameOf = (projectId: string | null): string | null =>
      projectById(projects, projectId)?.name ?? null;
    const processes = new Map<number, MonitorProcess>();
    for (const process of snapshot?.processes ?? []) {
      processes.set(process.pid, process);
    }
    const tracked = [...split.pinned, ...split.goodboy, ...split.workspace];
    const processRows = unmatchedStarted({
      started: startedByGoodboy({ snapshot, ledger, projects, sessionMounts }),
      rows,
    }).filter((row) => branch === null || row.branch === branch);
    const pinnedRows = filterPortRows({
      rows: split.pinned.filter((row) => isOnBranch({ row, branch, sessionMounts })),
      query,
      projectNameOf,
    });
    const goodboyRows = filterPortRows({
      rows: split.goodboy.filter((row) => isOnBranch({ row, branch, sessionMounts })),
      query,
      projectNameOf,
    });
    const workspaceRows = filterPortRows({
      rows: split.workspace.filter((row) => isOnBranch({ row, branch, sessionMounts })),
      query,
      projectNameOf,
    });
    const listeningRows = filterPortRows({
      rows: split.listening.filter((row) => isOnBranch({ row, branch, sessionMounts })),
      query,
      projectNameOf,
    });
    return {
      status: statusOf({
        hasSnapshot: snapshot !== null,
        isSupported: snapshot?.isPlatformSupported ?? true,
        error,
      }),
      error,
      takenAt: snapshot?.takenAt ?? null,
      summary: portSummary({ ports: tracked }),
      pinned: pinnedRows,
      goodboy: goodboyRows,
      workspace: workspaceRows,
      listening: listeningRows,
      processes: processRows,
      hiddenCount: split.hiddenCount,
      isTrackedEmpty: tracked.length === 0 && split.hiddenCount === 0,
      processOf: (pid) => (pid === null ? null : (processes.get(pid) ?? null)),
      query,
      branch,
      isBranchEmpty:
        branch !== null &&
        pinnedRows.length + goodboyRows.length + workspaceRows.length + listeningRows.length ===
          0 &&
        processRows.length === 0,
    };
  }, [
    snapshot,
    ledger,
    error,
    rows,
    scanned,
    pinned,
    hidden,
    projects,
    sessionMounts,
    query,
    branch,
  ]);
};
