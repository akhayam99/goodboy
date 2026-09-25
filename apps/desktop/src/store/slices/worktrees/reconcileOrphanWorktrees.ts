import { listWorktreeLedger, listWorktreeRoots, markWorktreeRootScanned } from '@goodboy/db';
import type { IsoDateTime, WorkspaceId, WorktreeLedgerEntry, WorktreeRoot } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { scanOrphanWorktrees, type OrphanWorktree } from '../../../features/worktree/worktree';
import { reconcileWorktreeOwnership } from '../mount-cleanup';
import { rememberWorktreeRoot } from '../storage/rememberWorktreeRoot';
import { syncOrphanLedger } from '../storage/syncOrphanLedger';
import type { GetFn, SetFn } from './types';

let inFlight: Promise<void> | null = null;
let queued = false;

const signature = (orphans: ReadonlyArray<OrphanWorktree>): string =>
  orphans
    .map((orphan) => orphan.path)
    .sort()
    .join('\n');

const listRoots = async (): Promise<ReadonlyArray<WorktreeRoot>> => {
  try {
    return await listWorktreeRoots({ db: tauriDatabase });
  } catch {
    return [];
  }
};

const listLedger = async (): Promise<ReadonlyArray<WorktreeLedgerEntry>> => {
  try {
    return await listWorktreeLedger({ db: tauriDatabase });
  } catch {
    return [];
  }
};

type MarkScannedParams = {
  readonly repoRoot: string;
};

const markScanned = async ({ repoRoot }: MarkScannedParams): Promise<void> => {
  try {
    await markWorktreeRootScanned({
      db: tauriDatabase,
      repoRoot,
      scannedAt: new Date().toISOString() as IsoDateTime,
    });
  } catch {
    return;
  }
};

const runReconcile = async (set: SetFn, get: GetFn): Promise<void> => {
  const projects = get().projects.filter((project) => project.kind === 'repo');
  for (const project of projects) {
    await rememberWorktreeRoot({ repoRoot: project.rootPath, addedBy: 'project' });
  }
  const roots = await listRoots();
  const rootPaths = [
    ...new Set([
      ...projects.map((project) => project.rootPath),
      ...roots.map((root) => root.repoRoot),
    ]),
  ];
  if (rootPaths.length === 0) {
    return;
  }
  const { knownPaths } = await reconcileWorktreeOwnership({ set, get });
  const ledger = await listLedger();
  const now = new Date().toISOString() as IsoDateTime;
  const found: Array<[WorkspaceId, ReadonlyArray<OrphanWorktree>]> = [];
  for (const repoRoot of rootPaths) {
    const scanned = await scanOrphanWorktrees({ repoPath: repoRoot, knownPaths }).catch(() => null);
    if (scanned === null) {
      continue;
    }
    const project = projects.find((candidate) => candidate.rootPath === repoRoot);
    const root = roots.find((candidate) => candidate.repoRoot === repoRoot);
    const owner = {
      workspaceId: project?.workspaceId ?? root?.workspaceId ?? null,
      projectId: project?.id ?? root?.projectId ?? null,
    };
    await syncOrphanLedger({ repoRoot, owner, orphans: scanned, ledger, now });
    await markScanned({ repoRoot });
    if (project === undefined) {
      continue;
    }
    const existingIndex = found.findIndex(([workspaceId]) => workspaceId === project.workspaceId);
    if (existingIndex < 0) {
      found.push([project.workspaceId, scanned]);
    }
    if (existingIndex >= 0) {
      const existing = found[existingIndex]!;
      found[existingIndex] = [existing[0], [...existing[1], ...scanned]];
    }
  }
  const previous = new Map<string, string>(
    found.map(([workspaceId]) => [
      workspaceId,
      signature(get().orphanWorktrees[workspaceId] ?? []),
    ]),
  );
  set((state) => {
    const next = { ...state.orphanWorktrees };
    for (const [workspaceId, orphans] of found) {
      next[workspaceId] = orphans;
    }
    return { orphanWorktrees: next };
  });
  for (const [workspaceId, orphans] of found) {
    if (orphans.length === 0 || previous.get(workspaceId) === signature(orphans)) {
      continue;
    }
    await get().emitNotification({
      kind: 'orphan-worktrees',
      severity: 'info',
      title: `${orphans.length} session folders left on disk`,
      body: 'They belong to no session any more. Review them in workspace settings and remove them when you want the space back.',
      workspaceId,
      action: { kind: 'open-orphan-worktrees', workspaceId },
    });
  }
};

export const reconcileOrphanWorktrees = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    if (inFlight !== null) {
      queued = true;
      await inFlight;
      return;
    }
    const run = runReconcile(set, get).finally(() => {
      inFlight = null;
    });
    inFlight = run;
    await run;
    if (queued) {
      queued = false;
      await reconcileOrphanWorktrees(set, get)();
    }
  };
};
