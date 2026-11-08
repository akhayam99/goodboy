import type {
  LedgerKind,
  LedgerRow,
  MonitorProcess,
  MonitorSnapshot,
} from '@goodboy/core/monitoring';
import type { Project } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { ledgerKindWord } from './ledgerKindWord';
import { ledgerMountOf } from './ledgerMountOf';
import type { OwnedMount } from './ownedMountsOf';

type Params = {
  readonly snapshot: MonitorSnapshot | null;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<OwnedMount>;
};

export type StartedRow = {
  readonly spawnId: string;
  readonly kind: LedgerKind;
  readonly name: string;
  readonly kindWord: string;
  readonly processName: string;
  readonly where: string;
  readonly mount: OwnedMount | null;
  readonly startedAt: number;
  readonly rssBytes: number;
  readonly pid: number;
};

type WhereParams = {
  readonly entry: LedgerRow;
  readonly mount: OwnedMount | null;
  readonly projects: Params['projects'];
};

const whereOf = ({ entry, mount, projects }: WhereParams): string => {
  if (mount === null) {
    return entry.cwd ?? 'Workspace';
  }
  const project = projectById(projects, mount.projectId);
  return project === undefined ? mount.branch : `${project.name} · ${mount.branch}`;
};

export const startedByGoodboy = ({
  snapshot,
  ledger,
  projects,
  mounts,
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
      const mount = ledgerMountOf({
        entry,
        mounts,
        sessionId: entry.sessionId,
        path: entry.mountPath ?? entry.cwd,
      });
      return {
        spawnId: entry.spawnId,
        kind: entry.kind,
        name: `${ledgerKindWord({ kind: entry.kind })} · ${process?.name ?? 'process'}`,
        kindWord: ledgerKindWord({ kind: entry.kind }),
        processName: process?.name ?? 'process',
        where: whereOf({ entry, mount, projects }),
        mount,
        startedAt: entry.startedAt,
        rssBytes: process?.rssBytes ?? 0,
        pid: entry.pid,
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
};
