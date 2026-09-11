import {
  listActiveResolveAttempts,
  listResolveAttempts,
  listResolveThreads,
  setResolveAttemptPhase,
  upsertResolveThread,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type {
  Agent,
  MountTargetSnapshot,
  ResolveAttempt,
  ResolveThread,
  WorktreeStatus,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import {
  acquireWorktreeWriter,
  cancelWorktreeWriter,
  releaseWorktreeWriter,
  worktreeStatus,
  worktreeWriterStatus,
} from '../../../features/worktree/worktree';
import { projectResolveRows } from './projectResolveRows';
import { resolveWorktreePath } from './resolveWorktreePath';
import {
  clearDirtyTreeReason,
  isDirtyTreeRow,
  withDirtyTreeReason,
} from './selectDirtyTreeThreads';
import type { DrainParams, SessionParams, SliceParams } from './types';

type Params = SliceParams & DrainParams;

type DirtyResult = {
  readonly blockedPaths: ReadonlySet<string>;
  readonly isSessionBlocked: boolean;
  readonly hasWritten: boolean;
};

type PathOf = (params: { readonly attempt: ResolveAttempt }) => Promise<string | null>;

type DirtyParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly rows: ReadonlyArray<ResolveThread>;
  readonly pathOf: PathOf;
  readonly endedAttemptId?: string;
};

const CLEAN: DirtyResult = {
  blockedPaths: new Set<string>(),
  isSessionBlocked: false,
  hasWritten: false,
};

const trackedChanges = ({ status }: { readonly status: WorktreeStatus }): number => {
  const tree = status.workingTree;
  return tree.kind === 'known' ? tree.staged + tree.unstaged + tree.unmerged : 0;
};

const startBaselines = new Map<string, number>();

const isWorktreeDirty = async ({
  worktreePath,
}: {
  readonly worktreePath: string;
}): Promise<boolean | null> => {
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  if (status === null) {
    return null;
  }
  const baseline = startBaselines.get(worktreePath);
  const currentChanges = trackedChanges({ status });
  return (
    status.inProgress !== null ||
    (baseline === undefined ? currentChanges > 0 : currentChanges > baseline)
  );
};

type ClearParams = { readonly rows: ReadonlyArray<ResolveThread> };

const clearDirtyRows = async ({ rows }: ClearParams): Promise<boolean> => {
  for (const row of rows) {
    await upsertResolveThread({
      db: tauriDatabase,
      row: { ...row, stateReason: clearDirtyTreeReason({ row }), updatedAt: Date.now() },
      expectedRevision: row.revision,
    });
  }
  return rows.length > 0;
};

const syncDirtyTree = async ({
  attempts,
  rows,
  pathOf,
  endedAttemptId,
}: DirtyParams): Promise<DirtyResult> => {
  const blocked = rows.filter((row) => isDirtyTreeRow({ row }));
  const ended = attempts.find((item) => item.id === endedAttemptId) ?? null;
  if (ended === null && blocked.length === 0) {
    return CLEAN;
  }
  const owners = new Map<string, Array<ResolveThread>>();
  const orphans: Array<ResolveThread> = [];
  for (const row of blocked) {
    const owner = attempts.find((item) => item.id === row.activeAttemptId) ?? null;
    const path = owner === null ? null : await pathOf({ attempt: owner });
    if (path === null) {
      orphans.push(row);
      continue;
    }
    owners.set(path, [...(owners.get(path) ?? []), row]);
  }
  const endedPath = ended === null ? null : await pathOf({ attempt: ended });
  const queuedPaths: Array<string> = [];
  for (const attempt of attempts.filter((item) => item.phase === 'queued')) {
    const path = await pathOf({ attempt });
    if (path !== null) {
      queuedPaths.push(path);
    }
  }
  const paths = new Set<string>([
    ...owners.keys(),
    ...(endedPath === null ? [] : [endedPath]),
    ...(orphans.length === 0 ? [] : queuedPaths),
  ]);
  const blockedPaths = new Set<string>();
  let hasWritten = false;
  for (const worktreePath of paths) {
    const isDirty = await isWorktreeDirty({ worktreePath });
    if (isDirty === null) {
      continue;
    }
    if (!isDirty) {
      startBaselines.delete(worktreePath);
      hasWritten = (await clearDirtyRows({ rows: owners.get(worktreePath) ?? [] })) || hasWritten;
      continue;
    }
    blockedPaths.add(worktreePath);
    if (ended === null || endedPath !== worktreePath) {
      continue;
    }
    for (const row of rows) {
      if (!ended.threadIds.includes(row.threadId)) {
        continue;
      }
      if (row.state === 'closed' || isDirtyTreeRow({ row })) {
        continue;
      }
      await upsertResolveThread({
        db: tauriDatabase,
        row: { ...row, stateReason: withDirtyTreeReason({ row }), updatedAt: Date.now() },
        expectedRevision: row.revision,
      });
      hasWritten = true;
    }
  }
  const isSessionBlocked = orphans.length > 0 && blockedPaths.size > 0;
  if (orphans.length > 0 && !isSessionBlocked) {
    hasWritten = (await clearDirtyRows({ rows: orphans })) || hasWritten;
  }
  return { blockedPaths, isSessionBlocked, hasWritten };
};

type HydrateParams = SliceParams &
  SessionParams & { readonly attempts: ReadonlyArray<ResolveAttempt> };

const hydrateRuns = async ({
  set,
  get,
  sessionId,
  attempts,
}: HydrateParams): Promise<ReadonlyArray<Agent> | null> => {
  const runs = get().sessionPhaseRuns[sessionId];
  if (runs !== undefined) {
    return runs;
  }
  if (!attempts.some((attempt) => attempt.phase === 'queued' || attempt.phase === 'running')) {
    return null;
  }
  const hydrated = await invokeAgentList(sessionId).catch(() => null);
  if (hydrated === null) {
    return null;
  }
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: hydrated } }));
  return hydrated;
};

const isParked = ({ agent }: { readonly agent: Agent | undefined }): boolean =>
  agent !== undefined && (agent.doneAt != null || agent.status === 'skipped');

type WaiterParams = {
  readonly worktreePath: string;
  readonly runs: ReadonlyArray<Agent>;
};

const evictStaleWaiters = async ({ worktreePath, runs }: WaiterParams): Promise<void> => {
  const lease = await worktreeWriterStatus({ path: worktreePath });
  if (lease.waiting.length === 0) {
    return;
  }
  const active = new Set<string>(
    (await listActiveResolveAttempts({ db: tauriDatabase })).map((attempt) => attempt.agentId),
  );
  for (const waiting of lease.waiting) {
    const agent = runs.find((item) => item.id === waiting);
    if (active.has(waiting) && !isParked({ agent })) {
      continue;
    }
    await cancelWorktreeWriter({ path: worktreePath, holder: waiting });
  }
};

type StartParams = SliceParams &
  SessionParams & {
    readonly attempt: ResolveAttempt;
    readonly instructions: string;
    readonly mountTarget: MountTargetSnapshot;
  };

type FailParams = SliceParams &
  SessionParams & {
    readonly attempt: ResolveAttempt;
    readonly error: string;
    readonly isCleanExit?: boolean;
  };

const failStart = async ({ get, sessionId, attempt, error, isCleanExit = false }: FailParams) => {
  await get().recordResolvePhase({
    sessionId,
    agentId: attempt.agentId,
    attemptId: attempt.id,
    phase: 'failed',
    error,
    isCleanExit,
  });
  void get().emitNotification('error', 'error', 'Fix failed to start', error, { sessionId });
};

const startResolverTurn = async ({
  set,
  get,
  sessionId,
  attempt,
  instructions,
  mountTarget,
}: StartParams): Promise<void> => {
  const worktreePath = mountTarget.worktreePath;
  const runsBefore = (get().agentRunHistory[attempt.agentId] ?? []).length;
  let isWriterLeaseDenied = false;
  try {
    const result = await get().sendTurn({
      sessionId,
      agentId: attempt.agentId,
      mountTarget,
      content: instructions,
    });
    isWriterLeaseDenied = result?.isWriterLeaseDenied === true;
    const current = (await listResolveAttempts({ db: tauriDatabase, sessionId })).find(
      (item) => item.id === attempt.id,
    );
    if (current?.phase === 'running') {
      const hasStarted = (get().agentRunHistory[attempt.agentId] ?? []).length > runsBefore;
      await failStart({
        set,
        get,
        sessionId,
        attempt,
        isCleanExit: hasStarted,
        error: hasStarted
          ? 'interrupted'
          : result?.blockedOverBudget === true
            ? 'every provider is over its budget cap'
            : 'the turn ended before the fix attempt started',
      });
    }
  } catch (error) {
    await failStart({ set, get, sessionId, attempt, error: formatError(error) });
  } finally {
    await releaseWorktreeWriter({ path: worktreePath, holder: attempt.agentId });
    if (!isWriterLeaseDenied) {
      await get().drainResolveQueue({ sessionId, endedAttemptId: attempt.id });
    }
  }
};

type ReleaseParams = {
  readonly attempt: ResolveAttempt;
  readonly worktreePath: string | null;
};

const releaseAttemptWaiter = async ({ attempt, worktreePath }: ReleaseParams): Promise<void> => {
  const path = worktreePath ?? attempt.mountTarget?.worktreePath ?? null;
  if (path === null) {
    return;
  }
  await cancelWorktreeWriter({ path, holder: attempt.agentId });
};

export const drainResolveQueue = async ({
  set,
  get,
  sessionId,
  endedAttemptId,
  worktreePath: scopedPath,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  let attempts = await listResolveAttempts({ db, sessionId });
  let rows = await listResolveThreads({ db, sessionId });
  const paths = new Map<string, string | null>();
  const pathOf = async ({
    attempt,
  }: {
    readonly attempt: ResolveAttempt;
  }): Promise<string | null> => {
    const known = paths.get(attempt.id);
    if (known !== undefined) {
      return known;
    }
    const resolved = await resolveWorktreePath({ get, sessionId, target: attempt.mountTarget });
    paths.set(attempt.id, resolved);
    return resolved;
  };
  const dirty = await syncDirtyTree({
    attempts,
    rows,
    pathOf,
    ...(endedAttemptId !== undefined && { endedAttemptId }),
  });
  if (dirty.hasWritten) {
    attempts = await listResolveAttempts({ db, sessionId });
    rows = await listResolveThreads({ db, sessionId });
  }
  projectResolveRows({ set, get, sessionId, rows, attempts });
  const runs = await hydrateRuns({ set, get, sessionId, attempts });
  if (runs === null || dirty.isSessionBlocked) {
    return;
  }
  if (attempts.some((attempt) => attempt.phase === 'running')) {
    return;
  }
  const deniedPaths = new Set<string>();
  let hasCancelled = false;
  for (const attempt of attempts.filter((item) => item.phase === 'queued')) {
    const worktreePath = await pathOf({ attempt });
    const agent = runs.find((item) => item.id === attempt.agentId);
    const instructions = attempt.instructions ?? '';
    if (agent === undefined || instructions.length === 0) {
      await setResolveAttemptPhase({
        db,
        id: attempt.id,
        phase: 'cancelled',
        error: 'interrupted',
      });
      await releaseAttemptWaiter({ attempt, worktreePath });
      hasCancelled = true;
      continue;
    }
    const mountTarget = attempt.mountTarget;
    if (worktreePath === null || mountTarget === null) {
      continue;
    }
    if (scopedPath !== undefined && scopedPath !== worktreePath) {
      continue;
    }
    if (dirty.blockedPaths.has(worktreePath) || deniedPaths.has(worktreePath)) {
      continue;
    }
    if (agent.doneAt != null || agent.status === 'skipped') {
      continue;
    }
    if (get().agentTurnState?.[attempt.agentId]?.kind === 'running') {
      return;
    }
    await evictStaleWaiters({ worktreePath, runs });
    const lease = await acquireWorktreeWriter({ path: worktreePath, holder: attempt.agentId });
    if (!lease.isGranted) {
      deniedPaths.add(worktreePath);
      continue;
    }
    const status = await worktreeStatus({ worktreePath }).catch(() => null);
    if (status === null) {
      startBaselines.delete(worktreePath);
    } else {
      startBaselines.set(worktreePath, trackedChanges({ status }));
    }
    await setResolveAttemptPhase({ db, id: attempt.id, phase: 'running' });
    projectResolveRows({
      set,
      get,
      sessionId,
      rows: await listResolveThreads({ db, sessionId }),
      attempts: await listResolveAttempts({ db, sessionId }),
    });
    void startResolverTurn({ set, get, sessionId, attempt, instructions, mountTarget });
    return;
  }
  if (hasCancelled) {
    projectResolveRows({
      set,
      get,
      sessionId,
      rows: await listResolveThreads({ db, sessionId }),
      attempts: await listResolveAttempts({ db, sessionId }),
    });
  }
};
