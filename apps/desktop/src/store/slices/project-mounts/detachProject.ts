import type {
  MountCleanupDecision,
  MountDiskState,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
} from '@goodboy/types';
import { deleteSessionMount } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { MOUNT_CLEANUP_BLOCKER_REASON, mountCleanupBlockers } from '../mount-cleanup/cleanupPolicy';
import { clearMountBranchObservation } from './mountBranchObservations';
import { withRepositoryAndMountLock } from './mountLocks';
import { loadMountViews } from './mountViews';
import { releaseMountSelection } from './releaseMountSelection';
import { runMountRemoval } from './runMountRemoval';
import { settleMountCleanupProposals } from './settleMountProposals';
import type { GetFn, SetFn } from './types';

export type DetachDisposition = 'keep-files' | 'remove-clean' | 'delete-files';

export type DetachProjectInput = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly disposition?: DetachDisposition;
};

export type DetachProjectOutcome = {
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly kind: MountCleanupDecision['kind'];
  readonly reason: string | null;
};

type CleanupSelection = {
  readonly keepDirectory: boolean;
  readonly mode: 'safe' | 'confirmed';
};

const selectCleanup = ({
  disposition,
}: {
  readonly disposition: DetachDisposition;
}): CleanupSelection => {
  switch (disposition) {
    case 'keep-files':
      return { keepDirectory: true, mode: 'safe' };
    case 'remove-clean':
      return { keepDirectory: false, mode: 'safe' };
    case 'delete-files':
      return { keepDirectory: false, mode: 'confirmed' };
  }
};

type DetachTarget = {
  readonly mountId: MountId;
  readonly mountName: string;
  readonly branch: string;
  readonly repoRoot: string;
  readonly diskState: MountDiskState;
  readonly directory: string | null;
  readonly worktreePath: string | null;
  readonly path: string;
  readonly revision: number;
};

const isGone = ({ diskState }: { readonly diskState: MountDiskState }): boolean =>
  diskState === 'missing' || diskState === 'removed';

const directoryOf = ({ view }: { readonly view: SessionMountView }): string | null => {
  if (view.worktreePath !== null) {
    return view.worktreePath;
  }
  return isGone({ diskState: view.diskState }) ? null : view.lastWorktreePath;
};

type TargetParams = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly projectId: ProjectId;
};

const detachTargets = ({ views, projectId }: TargetParams): ReadonlyArray<DetachTarget> =>
  views
    .filter((view) => view.projectId === projectId)
    .map((view) => ({
      mountId: view.id,
      mountName: view.mountName,
      branch: view.branch,
      repoRoot: view.repoRoot,
      diskState: view.diskState,
      directory: directoryOf({ view }),
      worktreePath: view.worktreePath,
      path: view.worktreePath ?? view.lastWorktreePath ?? '',
      revision: view.revision,
    }));

type DropParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly target: DetachTarget;
};

const dropMountFromSession = ({ set, sessionId, target }: DropParams): void => {
  set((state) => {
    const views = state.sessionMounts[sessionId];
    return {
      ...(views === undefined
        ? {}
        : {
            sessionMounts: {
              ...state.sessionMounts,
              [sessionId]: views.filter((view) => view.id !== target.mountId),
            },
          }),
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [sessionId]: (state.sessionProjectMounts[sessionId] ?? []).filter(
          (candidate) => candidate.mountId !== target.mountId,
        ),
      },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [sessionId]: (state.sessionWorktrees[sessionId] ?? []).filter(
          (path) => target.worktreePath === null || path !== target.worktreePath,
        ),
      },
    };
  });
};

type RemoveTargetParams = {
  readonly get: GetFn;
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly target: DetachTarget;
  readonly selection: CleanupSelection;
  readonly isRepoProject: boolean;
};

const removeTarget = async ({
  get,
  set,
  sessionId,
  projectId,
  target,
  selection,
  isRepoProject,
}: RemoveTargetParams): Promise<DetachProjectOutcome> => {
  const dropRow = async ({ kept }: { readonly kept: boolean }): Promise<boolean> => {
    await settleMountCleanupProposals({
      set,
      sessionId,
      mountId: target.mountId,
      outcome: kept ? 'kept' : 'removed',
    });
    await deleteSessionMount({ db: tauriDatabase, sessionId, mountId: target.mountId });
    return true;
  };
  const directory = target.directory;
  if (directory === null) {
    await withRepositoryAndMountLock({
      repoRoot: target.repoRoot,
      mountKey: `${sessionId}:${target.mountId}`,
      run: () => dropRow({ kept: false }),
    });
    return { mountId: target.mountId, worktreePath: target.path, kind: 'missing', reason: null };
  }
  const { decision } = await runMountRemoval({
    get,
    mode: selection.mode,
    keepDirectory: selection.keepDirectory,
    finish: 'drop-row',
    expectedRevision: target.revision,
    target: {
      sessionId,
      mountId: target.mountId,
      projectId,
      repoRoot: target.repoRoot,
      worktreePath: directory,
      branch: target.branch,
      diskState: target.diskState,
      isRepoProject,
    },
    finishRow: ({ decision: removal }) => dropRow({ kept: removal.kind === 'kept' }),
  });
  return {
    mountId: target.mountId,
    worktreePath: target.path,
    kind: decision.kind,
    reason: decision.kind === 'kept' || decision.kind === 'failed' ? decision.reason : null,
  };
};

export const detachProject = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    projectId,
    disposition = 'remove-clean',
  }: DetachProjectInput): Promise<ReadonlyArray<DetachProjectOutcome>> => {
    const views = await loadMountViews({ get, sessionId });
    const targets = detachTargets({ views, projectId });
    const first = targets[0];
    if (first === undefined) {
      throw new Error(`project not mounted in this session: ${projectId}`);
    }
    const project = get().projects.find((candidate) => candidate.id === projectId);
    const projectName = project?.name ?? first.mountName;
    const selection = selectCleanup({ disposition });
    const outcomes: Array<DetachProjectOutcome> = [];
    const released: Array<MountId> = [];
    for (const target of targets) {
      const blockers = mountCleanupBlockers({
        state: get(),
        sessionId,
        mountId: target.mountId,
        worktreePath: target.path,
      });
      if (blockers.length > 0) {
        outcomes.push({
          mountId: target.mountId,
          worktreePath: target.path,
          kind: 'failed',
          reason: blockers.map((blocker) => MOUNT_CLEANUP_BLOCKER_REASON[blocker]).join(', '),
        });
        continue;
      }
      const outcome = await removeTarget({
        get,
        set,
        sessionId,
        projectId,
        target,
        selection,
        isRepoProject: project?.kind === 'repo',
      }).catch((error: unknown): DetachProjectOutcome => ({
        mountId: target.mountId,
        worktreePath: target.path,
        kind: 'failed',
        reason: formatError(error),
      }));
      outcomes.push(outcome);
      if (outcome.kind === 'failed') {
        continue;
      }
      released.push(target.mountId);
      dropMountFromSession({ set, sessionId, target });
      clearMountBranchObservation({ set, sessionId, mountId: target.mountId });
      await get()
        .recordSessionEvent({
          sessionId,
          kind: 'project_detached',
          payload: {
            mountId: target.mountId,
            projectId,
            projectName,
            branch: target.branch,
            worktreePath: target.path,
            kept: outcome.kind === 'kept',
            ...(outcome.reason !== null ? { reason: outcome.reason } : {}),
          },
        })
        .catch(() => undefined);
    }
    const remaining = get().sessionProjectMounts[sessionId] ?? [];
    const hasFailure = outcomes.some((outcome) => outcome.kind === 'failed');
    const isDetached =
      !hasFailure && remaining.every((candidate) => candidate.projectId !== projectId);
    await releaseMountSelection({
      set,
      get,
      sessionId,
      released,
      departedProjectId: isDetached ? projectId : null,
    });
    if (outcomes.some((outcome) => outcome.kind === 'kept')) {
      void get()
        .reconcileOrphanWorktrees()
        .catch(() => undefined);
    }
    return outcomes;
  };
};
