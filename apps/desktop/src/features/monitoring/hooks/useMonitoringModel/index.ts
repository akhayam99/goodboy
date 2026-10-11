import { useMemo, useState } from 'react';
import type { LedgerRow, MonitorProcess, PortRow } from '@goodboy/core';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { filterPortRows } from '../../filterPortRows';
import { portSummary, type PortSummary } from '../../portSummary';
import { splitPortRows } from '../../splitPortRows';
import { startedByGoodboy, type StartedRow } from '../../startedByGoodboy';
import { watchedPortSet } from '../../watchedPortSet';

export type MonitoringStatus = 'loading' | 'failed' | 'unsupported' | 'ready';

export type MonitoringModel = {
  readonly status: MonitoringStatus;
  readonly error: string | null;
  readonly takenAt: number | null;
  readonly summary: PortSummary;
  readonly ports: ReadonlyArray<PortRow>;
  readonly also: ReadonlyArray<PortRow>;
  readonly started: ReadonlyArray<StartedRow>;
  readonly projects: ReadonlyArray<Project>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly query: string;
  readonly setQuery: (query: string) => void;
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
  const watched = useAppStore((state) => state.monitorWatched);
  const learned = useAppStore((state) => state.monitorLearned);
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const [query, setQuery] = useState('');

  return useMemo(() => {
    const watchedPorts = watchedPortSet({ scanned, watched, learned });
    const split = splitPortRows({ rows, watchedPorts });
    const projectNameOf = (projectId: string | null): string | null =>
      projects.find((project) => project.id === projectId)?.name ?? null;
    const processes = new Map<number, MonitorProcess>();
    for (const process of snapshot?.processes ?? []) {
      processes.set(process.pid, process);
    }
    return {
      status: statusOf({
        hasSnapshot: snapshot !== null,
        isSupported: snapshot?.isPlatformSupported ?? true,
        error,
      }),
      error,
      takenAt: snapshot?.takenAt ?? null,
      summary: portSummary({ ports: split.ports }),
      ports: filterPortRows({ rows: split.ports, query, projectNameOf }),
      also: filterPortRows({ rows: split.also, query, projectNameOf }),
      started: startedByGoodboy({ snapshot, ledger, projects, sessionMounts }),
      projects,
      processOf: (pid) => (pid === null ? null : (processes.get(pid) ?? null)),
      ledger,
      query,
      setQuery,
    };
  }, [snapshot, ledger, error, rows, scanned, watched, learned, projects, sessionMounts, query]);
};
