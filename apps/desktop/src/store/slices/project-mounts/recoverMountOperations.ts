import {
  deleteSessionMount,
  getMountOperation,
  insertSessionMount,
  listMountOperations,
  updateSessionMountLifecycle,
} from '@goodboy/db';
import type { IsoDateTime, MountId, MountOperation, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { inspectWorktree } from '../../../features/worktree/worktree';
import {
  failMountOperation,
  markMountOperationUncertain,
  plannedMountId,
  succeedMountOperation,
} from './mountOperations';
import { applyMountViews, loadMountViews } from './mountViews';
import { withMountLock } from './mountLocks';
import { MOUNT_REMOVAL_FINISHES } from './runMountRemoval';
import { settleMountCleanupProposals } from './settleMountProposals';
import { verifyMountViews } from './verifyMountViews';
import type { GetFn, SessionKeyInput, SetFn } from './types';

const readPath = ({ operation }: { readonly operation: MountOperation }): string | null => {
  const sources = [operation.result, operation.input];
  const found = sources.find((source) => {
    if (source === null || typeof source !== 'object') {
      return false;
    }
    return typeof (source as { worktreePath?: unknown }).worktreePath === 'string';
  });
  if (found === undefined) {
    return null;
  }
  return (found as { readonly worktreePath: string }).worktreePath;
};

const readRepoRoot = ({ operation }: { readonly operation: MountOperation }): string | null => {
  const sources = [operation.result, operation.input];
  const found = sources.find((source) => {
    if (source === null || typeof source !== 'object') {
      return false;
    }
    return typeof (source as { repoRoot?: unknown }).repoRoot === 'string';
  });
  if (found === undefined) {
    return null;
  }
  return (found as { readonly repoRoot: string }).repoRoot;
};

const readString = ({ source, key }: { readonly source: unknown; readonly key: string }) => {
  if (source === null || typeof source !== 'object') {
    return null;
  }
  const value = (source as Readonly<Record<string, unknown>>)[key];
  return typeof value === 'string' ? value : null;
};

type RecoverForkParams = {
  readonly get: GetFn;
  readonly operation: MountOperation;
  readonly views: Awaited<ReturnType<typeof loadMountViews>>;
};

const recoverFork = async ({ get, operation, views }: RecoverForkParams): Promise<boolean> => {
  const mountId =
    operation.mountId ??
    (readString({ source: operation.result, key: 'mountId' }) as MountId | null) ??
    plannedMountId({ operation });
  const worktreePath = readPath({ operation });
  const repoRoot = readRepoRoot({ operation });
  const branch = readString({ source: operation.result, key: 'branch' });
  const projectId = readString({ source: operation.input, key: 'projectId' });
  if (
    mountId === null ||
    worktreePath === null ||
    repoRoot === null ||
    branch === null ||
    projectId === null
  ) {
    return false;
  }
  const inspection = await inspectWorktree({ repoPath: repoRoot, worktreePath }).catch(() => null);
  if (inspection?.kind !== 'registered' || inspection.isMain) {
    return false;
  }
  const project = get().projects.find((candidate) => candidate.id === projectId);
  if (project === undefined || project.rootPath !== repoRoot) {
    return false;
  }
  const baseBranch = readString({ source: operation.input, key: 'baseBranch' });
  const mountName = readString({ source: operation.input, key: 'mountName' });
  const timestamp = new Date().toISOString() as IsoDateTime;
  await insertSessionMount({
    db: tauriDatabase,
    mount: {
      id: mountId,
      sessionId: operation.sessionId,
      projectId: projectId as ProjectId,
      worktreePath,
      lastWorktreePath: worktreePath,
      branch,
      baseBranch: baseBranch ?? project.baseBranch ?? null,
      parallelIndex: views.reduce((highest, view) => Math.max(highest, view.parallelIndex), 0) + 1,
      mountName: mountName ?? project.name,
      repoSlug: null,
      isAttached: true,
      diskState: 'present',
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
  await succeedMountOperation({
    operation,
    result: { mountId, worktreePath, branch, repoRoot },
  });
  return true;
};

type RecoverUnmountParams = {
  readonly operation: MountOperation;
  readonly mountId: MountId;
  readonly revision: number;
};

const recoverUnmount = async ({
  operation,
  mountId,
  revision,
}: RecoverUnmountParams): Promise<boolean> => {
  const worktreePath = readPath({ operation });
  const repoRoot = readRepoRoot({ operation });
  if (worktreePath === null || repoRoot === null) {
    return false;
  }
  const inspection = await inspectWorktree({ repoPath: repoRoot, worktreePath }).catch(() => null);
  if (inspection?.kind !== 'missing') {
    return false;
  }
  const timestamp = new Date().toISOString() as IsoDateTime;
  const written = await updateSessionMountLifecycle({
    db: tauriDatabase,
    sessionId: operation.sessionId,
    mountId,
    worktreePath: null,
    isAttached: false,
    diskState: 'removed',
    expectedRevision: revision,
    updatedAt: timestamp,
  });
  if (!written) {
    return false;
  }
  await succeedMountOperation({ operation });
  return true;
};

type RemovalOutcome = 'succeeded' | 'failed' | 'uncertain';

const readFlag = ({ source, key }: { readonly source: unknown; readonly key: string }) => {
  if (source === null || typeof source !== 'object') {
    return false;
  }
  return (source as Readonly<Record<string, unknown>>)[key] === true;
};

type RecoverRemovalParams = {
  readonly set: SetFn;
  readonly operation: MountOperation;
  readonly views: Awaited<ReturnType<typeof loadMountViews>>;
};

type DropRowParams = {
  readonly set: SetFn;
  readonly operation: MountOperation;
  readonly mountId: MountId;
  readonly kept: boolean;
};

const finishDropRow = async ({
  set,
  operation,
  mountId,
  kept,
}: DropRowParams): Promise<RemovalOutcome> => {
  await settleMountCleanupProposals({
    set,
    sessionId: operation.sessionId,
    mountId,
    outcome: kept ? 'kept' : 'removed',
  });
  await deleteSessionMount({ db: tauriDatabase, sessionId: operation.sessionId, mountId });
  await succeedMountOperation({ operation: { ...operation, mountId: null } });
  return 'succeeded';
};

const readFinish = ({ operation }: { readonly operation: MountOperation }) => {
  const finish = readString({ source: operation.input, key: 'finish' });
  return MOUNT_REMOVAL_FINISHES.find((candidate) => candidate === finish) ?? null;
};

const recoverRemoval = async ({
  set,
  operation,
  views,
}: RecoverRemovalParams): Promise<RemovalOutcome> => {
  const mountId = readString({ source: operation.input, key: 'mountId' });
  const finish = readFinish({ operation });
  const worktreePath = readPath({ operation });
  const repoRoot = readRepoRoot({ operation });
  if (mountId === null || finish === null || worktreePath === null || repoRoot === null) {
    await failMountOperation({ operation, errorCode: 'unknown-state' });
    return 'failed';
  }
  const settled = finish === 'drop-row' ? { ...operation, mountId: null } : operation;
  const row = views.find((candidate) => candidate.id === mountId);
  if (row === undefined) {
    await succeedMountOperation({ operation: { ...operation, mountId: null } });
    return 'succeeded';
  }
  const inspection = await inspectWorktree({ repoPath: repoRoot, worktreePath }).catch(() => null);
  if (inspection === null || inspection.kind === 'repository-unavailable') {
    await markMountOperationUncertain({
      operation: settled,
      errorCode: 'repository-unavailable',
      shouldRearmRecovery: false,
    });
    return 'uncertain';
  }
  const isGone = inspection.kind === 'missing';
  const keepDirectory = readFlag({ source: operation.input, key: 'keepDirectory' });
  if (finish === 'drop-row' && (isGone || keepDirectory)) {
    return finishDropRow({ set, operation, mountId: row.id, kept: !isGone });
  }
  if (!isGone) {
    await failMountOperation({ operation: settled, errorCode: 'cleanup-failed' });
    return 'failed';
  }
  if (row.worktreePath !== worktreePath) {
    await succeedMountOperation({ operation: settled });
    return 'succeeded';
  }
  const written = await updateSessionMountLifecycle({
    db: tauriDatabase,
    sessionId: operation.sessionId,
    mountId: row.id,
    worktreePath: null,
    isAttached: false,
    diskState: 'removed',
    expectedRevision: row.revision,
    updatedAt: new Date().toISOString() as IsoDateTime,
  });
  if (!written) {
    await markMountOperationUncertain({
      operation: settled,
      errorCode: 'revision-conflict',
      shouldRearmRecovery: false,
    });
    return 'uncertain';
  }
  await succeedMountOperation({ operation: settled });
  return 'succeeded';
};

type RecoverOperationParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly operation: MountOperation;
  readonly views: Awaited<ReturnType<typeof loadMountViews>>;
};

const recoverOperation = async ({
  set,
  get,
  operation,
  views,
}: RecoverOperationParams): Promise<boolean> => {
  if (operation.kind === 'remove') {
    const outcome = await recoverRemoval({ set, operation, views });
    return outcome !== 'uncertain';
  }
  const recorded = views.find((candidate) => candidate.id === operation.mountId);
  if (recorded !== undefined && operation.kind === 'unmount') {
    if (recorded.worktreePath === null && !recorded.isAttached) {
      await succeedMountOperation({ operation });
      return true;
    }
    const recovered = await recoverUnmount({
      operation,
      mountId: recorded.id,
      revision: recorded.revision,
    });
    if (recovered) {
      return true;
    }
    await markMountOperationUncertain({
      operation,
      errorCode: 'unknown-state',
      shouldRearmRecovery: false,
    });
    return false;
  }
  if (recorded !== undefined) {
    await succeedMountOperation({ operation });
    return true;
  }
  if (operation.kind === 'fork') {
    const recovered = await recoverFork({ get, operation, views }).catch(() => false);
    if (recovered) {
      return true;
    }
  }
  const worktreePath = readPath({ operation });
  const repoRoot = readRepoRoot({ operation });
  if (worktreePath === null || repoRoot === null) {
    await failMountOperation({ operation, errorCode: 'unknown-state' });
    return true;
  }
  const inspection = await inspectWorktree({ repoPath: repoRoot, worktreePath }).catch(() => null);
  if (inspection === null || inspection.kind === 'repository-unavailable') {
    await markMountOperationUncertain({
      operation,
      errorCode: 'repository-unavailable',
      shouldRearmRecovery: false,
    });
    return false;
  }
  if (inspection.kind === 'missing') {
    await failMountOperation({ operation, errorCode: 'unknown-state' });
    return true;
  }
  await markMountOperationUncertain({
    operation,
    errorCode: 'directory-occupied',
    shouldRearmRecovery: false,
  });
  return false;
};

const isRecoverable = ({ operation }: { readonly operation: MountOperation }): boolean =>
  operation.status === 'running' || operation.status === 'uncertain';

export const recoverMountOperations = (set: SetFn, get: GetFn) => {
  return async ({ sessionId }: SessionKeyInput): Promise<number> => {
    const operations = await listMountOperations({ db: tauriDatabase, sessionId });
    const unsettled = operations.filter((operation) => isRecoverable({ operation }));
    if (unsettled.length === 0) {
      return 0;
    }
    let settled = 0;
    for (const listed of unsettled) {
      const recover = async (): Promise<boolean> => {
        const operation = await getMountOperation({
          db: tauriDatabase,
          sessionId,
          requestId: listed.requestId,
        });
        if (operation === null || !isRecoverable({ operation })) {
          return false;
        }
        const views = await loadMountViews({ get, sessionId });
        return recoverOperation({ set, get, operation, views });
      };
      const repoRoot = readRepoRoot({ operation: listed });
      const isSettled =
        repoRoot === null
          ? await recover()
          : await withMountLock({ key: `repo:${repoRoot}`, run: recover });
      if (isSettled) {
        settled += 1;
      }
    }
    const views = await loadMountViews({ get, sessionId });
    applyMountViews({ set, sessionId, views: await verifyMountViews({ get, sessionId, views }) });
    return settled;
  };
};
