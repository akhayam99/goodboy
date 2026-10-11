import type { LedgerKind, LedgerRow, MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import type { Project, SessionMountView } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { ledgerKindWord } from './ledgerKindWord';

type Params = {
  readonly snapshot: MonitorSnapshot | null;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly projects: ReadonlyArray<Project>;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

export type StartedRow = {
  readonly spawnId: string;
  readonly kind: LedgerKind;
  readonly name: string;
  readonly where: string;
  readonly startedAt: number;
  readonly rssBytes: number;
  readonly pid: number;
};

type WhereParams = {
  readonly entry: LedgerRow;
  readonly projects: Params['projects'];
  readonly sessionMounts: Params['sessionMounts'];
};

const whereOf = ({ entry, projects, sessionMounts }: WhereParams): string => {
  const mounts = entry.sessionId === null ? [] : (sessionMounts[entry.sessionId] ?? []);
  const mount = mounts.find((item) => item.worktreePath === entry.mountPath);
  if (mount === undefined) {
    return entry.cwd ?? 'Workspace';
  }
  const project = projectById(projects, mount.projectId);
  return project === undefined ? mount.branch : `${project.name} · ${mount.branch}`;
};

export const startedByGoodboy = ({
  snapshot,
  ledger,
  projects,
  sessionMounts,
}: Params): ReadonlyArray<StartedRow> => {
  if (snapshot === null) {
    return [];
  }
  const processes = new Map<number, MonitorProcess>();
  for (const process of snapshot.processes) {
    processes.set(process.pid, process);
  }
  return ledger
    .filter((entry) => entry.kind !== 'probe' && processes.has(entry.pid))
    .map((entry) => {
      const process = processes.get(entry.pid);
      return {
        spawnId: entry.spawnId,
        kind: entry.kind,
        name: `${ledgerKindWord({ kind: entry.kind })} · ${process?.name ?? 'process'}`,
        where: whereOf({ entry, projects, sessionMounts }),
        startedAt: entry.startedAt,
        rssBytes: process?.rssBytes ?? 0,
        pid: entry.pid,
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
};
