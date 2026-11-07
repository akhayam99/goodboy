import type {
  LedgerKind,
  LedgerRow,
  MonitorProcess,
  MonitorSnapshot,
} from '@goodboy/core/monitoring';
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
  readonly kindWord: string;
  readonly processName: string;
  readonly where: string;
  readonly branch: string | null;
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

const branchOf = ({
  entry,
  sessionMounts,
}: Pick<WhereParams, 'entry' | 'sessionMounts'>): string | null => {
  const mounts = entry.sessionId === null ? [] : (sessionMounts[entry.sessionId] ?? []);
  return mounts.find((item) => item.worktreePath === entry.mountPath)?.branch ?? null;
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
        kindWord: ledgerKindWord({ kind: entry.kind }),
        processName: process?.name ?? 'process',
        where: whereOf({ entry, projects, sessionMounts }),
        branch: branchOf({ entry, sessionMounts }),
        startedAt: entry.startedAt,
        rssBytes: process?.rssBytes ?? 0,
        pid: entry.pid,
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
};
