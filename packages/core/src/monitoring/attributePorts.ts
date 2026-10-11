import { locateByPath } from './locateByPath';
import type {
  AttributionProject,
  AttributionSession,
  LearnedPorts,
  LedgerKind,
  LedgerRow,
  Location,
  MonitorListener,
  MonitorProcess,
  MonitorSnapshot,
  PortOwner,
  PortRow,
  WatchedByProject,
  WatchedPort,
} from './types';

type Params = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly sessions: ReadonlyArray<AttributionSession>;
  readonly projects: ReadonlyArray<AttributionProject>;
  readonly watched: WatchedByProject;
  readonly learned: LearnedPorts;
};

type LedgerOwnerKind = 'script' | 'terminal' | 'agent';

const LEDGER_OWNER_KIND: Readonly<Record<LedgerKind, LedgerOwnerKind | null>> = {
  script: 'script',
  terminal: 'terminal',
  turn: 'agent',
  chat: 'agent',
  planner: 'agent',
  summary: 'agent',
  probe: null,
};

const OWNER_RANK: Readonly<Record<LedgerOwnerKind, number>> = {
  script: 0,
  terminal: 1,
  agent: 2,
};

const isHeldBy = (entry: LedgerRow, process: MonitorProcess | undefined, pid: number): boolean => {
  if (entry.pid === pid) {
    return true;
  }
  if (process === undefined) {
    return false;
  }
  return entry.pid === process.ppid || (entry.pgid !== null && entry.pgid === process.pgid);
};

const pickLedgerEntry = (
  ledger: ReadonlyArray<LedgerRow>,
  process: MonitorProcess | undefined,
  pid: number,
): LedgerRow | null => {
  let best: LedgerRow | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const entry of ledger) {
    const kind = LEDGER_OWNER_KIND[entry.kind];
    if (kind === null || !isHeldBy(entry, process, pid)) {
      continue;
    }
    if (OWNER_RANK[kind] < bestRank) {
      best = entry;
      bestRank = OWNER_RANK[kind];
    }
  }
  return best;
};

const locationPaths = (
  entry: LedgerRow | null,
  process: MonitorProcess | undefined,
): ReadonlyArray<string> => {
  const paths: string[] = [];
  for (const path of [entry?.mountPath, process?.cwd, entry?.cwd]) {
    if (typeof path === 'string' && path.length > 0) {
      paths.push(path);
    }
  }
  return paths;
};

const ownerFor = (
  entry: LedgerRow | null,
  process: MonitorProcess | undefined,
  location: Location,
): PortOwner => {
  if (entry !== null) {
    const kind = LEDGER_OWNER_KIND[entry.kind] ?? 'agent';
    return {
      kind,
      spawnId: entry.spawnId,
      ledgerKind: entry.kind,
      sessionId: entry.sessionId ?? location.sessionId,
      worktreePath: location.worktreePath,
      projectId: location.projectId,
    };
  }
  if (location.sessionId !== null && location.worktreePath !== null) {
    return {
      kind: 'worktree',
      sessionId: location.sessionId,
      worktreePath: location.worktreePath,
      projectId: location.projectId,
    };
  }
  if (location.projectId !== null) {
    return { kind: 'project', projectId: location.projectId };
  }
  return { kind: 'external', name: process?.name ?? 'unknown' };
};

const projectIdOf = (owner: PortOwner): string | null => {
  if (owner.kind === 'external') {
    return null;
  }
  return owner.projectId;
};

const worktreeKeyOf = (owner: PortOwner): string | null => {
  if (owner.kind === 'external' || owner.kind === 'project') {
    return null;
  }
  return owner.worktreePath;
};

const watchedSetFor = (
  projectId: string,
  watched: WatchedByProject,
  learned: LearnedPorts,
): ReadonlyMap<number, WatchedPort> => {
  const set = new Map<number, WatchedPort>();
  for (const item of watched[projectId] ?? []) {
    if (!set.has(item.port)) {
      set.set(item.port, item);
    }
  }
  for (const port of learned[projectId] ?? []) {
    if (!set.has(port)) {
      set.set(port, { port, label: `:${port}`, source: 'learned', relDir: '' });
    }
  }
  return set;
};

const runningWorktrees = (
  ledger: ReadonlyArray<LedgerRow>,
  sessions: ReadonlyArray<AttributionSession>,
  projects: ReadonlyArray<AttributionProject>,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const byProject = new Map<string, Set<string>>();
  for (const entry of ledger) {
    if (LEDGER_OWNER_KIND[entry.kind] === null) {
      continue;
    }
    const location = locateByPath({
      paths: locationPaths(entry, undefined),
      sessions,
      projects,
    });
    if (location.projectId === null || location.worktreePath === null) {
      continue;
    }
    const set = byProject.get(location.projectId) ?? new Set<string>();
    set.add(location.worktreePath);
    byProject.set(location.projectId, set);
  }
  return byProject;
};

const groupListeners = (
  listeners: ReadonlyArray<MonitorListener>,
): ReadonlyArray<MonitorListener> => {
  const seen = new Set<string>();
  const out: MonitorListener[] = [];
  for (const listener of listeners) {
    const key = `${listener.port}:${listener.pid}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(listener);
  }
  return out;
};

export const attributePorts = ({
  snapshot,
  ledger,
  sessions,
  projects,
  watched,
  learned,
}: Params): ReadonlyArray<PortRow> => {
  const processes = new Map<number, MonitorProcess>();
  for (const process of snapshot.processes) {
    processes.set(process.pid, process);
  }
  const running = runningWorktrees(ledger, sessions, projects);
  const rows: PortRow[] = [];
  const heldPorts = new Set<number>();
  const heldByProject = new Map<string, Set<number>>();
  for (const listener of groupListeners(snapshot.listeners)) {
    const process = processes.get(listener.pid);
    const entry = pickLedgerEntry(ledger, process, listener.pid);
    const location = locateByPath({
      paths: locationPaths(entry, process),
      sessions,
      projects,
    });
    const owner = ownerFor(entry, process, location);
    const projectId = projectIdOf(owner);
    const watchedItem =
      projectId === null
        ? undefined
        : watchedSetFor(projectId, watched, learned).get(listener.port);
    heldPorts.add(listener.port);
    if (projectId !== null) {
      const held = heldByProject.get(projectId) ?? new Set<number>();
      held.add(listener.port);
      heldByProject.set(projectId, held);
    }
    const holderWorktree = worktreeKeyOf(owner);
    const others =
      projectId === null || watchedItem === undefined
        ? 0
        : [...(running.get(projectId) ?? [])].filter((path) => path !== holderWorktree).length;
    rows.push({
      key: `${listener.port}:${listener.pid}`,
      port: listener.port,
      address: listener.address,
      pid: listener.pid,
      processName: process?.name ?? null,
      state: 'listening',
      owner,
      projectId,
      label: watchedItem?.label ?? null,
      isWatched: watchedItem !== undefined,
      ...(others > 0 ? { collision: { others } } : {}),
    });
  }
  for (const project of projects) {
    const held = heldByProject.get(project.id);
    for (const item of watchedSetFor(project.id, watched, learned).values()) {
      if (held?.has(item.port) === true || heldPorts.has(item.port)) {
        continue;
      }
      rows.push({
        key: `free:${project.id}:${item.port}`,
        port: item.port,
        address: null,
        pid: null,
        processName: null,
        state: 'free',
        owner: null,
        projectId: project.id,
        label: item.label,
        isWatched: true,
      });
    }
  }
  return rows.sort((a, b) => a.port - b.port || a.key.localeCompare(b.key));
};
