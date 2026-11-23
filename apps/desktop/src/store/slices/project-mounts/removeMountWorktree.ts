import { updateSessionMountLifecycle } from '@goodboy/db';
import type {
  IsoDateTime,
  MountCleanupDecision,
  MountId,
  SessionId,
  SessionMountView,
  WorktreeRemovalMode,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { announceWorktreesChanged } from '../storage/announceWorktreesChanged';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import { requireMountContext } from './requireMountContext';
import { runMountRemoval } from './runMountRemoval';
import type { GetFn, SetFn } from './types';

export type RemoveMountWorktreeInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly mode: WorktreeRemovalMode;
  readonly expected?: MountRemovalSnapshot;
};

export type MountRemovalSnapshot = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly revision: number;
};

export type RemoveMountWorktreeResult = {
  readonly kind: MountCleanupDecision['kind'];
  readonly reason: string | null;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type MatchParams = {
  readonly view: SessionMountView;
  readonly expected: MountRemovalSnapshot | undefined;
};

const MOUNT_CHANGED_REASON = 'the mount changed after this list was read';

const matchesExpected = ({ view, expected }: MatchParams): boolean =>
  expected === undefined ||
  (view.worktreePath === expected.worktreePath &&
    view.branch === expected.branch &&
    view.revision === expected.revision);

export const removeMountWorktree = ({ set, get }: Params) => {
  return async ({
    sessionId,
    mountId,
    mode,
    expected,
  }: RemoveMountWorktreeInput): Promise<RemoveMountWorktreeResult> => {
    const views = await loadMountViews({ get, sessionId });
    const view = requireMountView({ views, mountId });
    const { project } = requireMountContext({ get, sessionId, projectId: view.projectId });
    const worktreePath = view.worktreePath;
    if (!matchesExpected({ view, expected })) {
      return { kind: 'kept', reason: MOUNT_CHANGED_REASON };
    }
    if (worktreePath === null) {
      return { kind: 'missing', reason: null };
    }
    const cleanup = await runMountRemoval({
      get,
      mode,
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: view.revision,
      isStillRemovable: async () => {
        const fresh = (await loadMountViews({ get, sessionId })).find(
          (candidate) => candidate.id === mountId,
        );
        return (
          fresh !== undefined &&
          fresh.revision === view.revision &&
          fresh.worktreePath === worktreePath &&
          fresh.branch === view.branch
        );
      },
      target: {
        sessionId,
        mountId,
        projectId: view.projectId,
        repoRoot: view.repoRoot,
        worktreePath,
        branch: view.branch,
        diskState: view.diskState,
        isRepoProject: project.kind === 'repo',
      },
      finishRow: async ({ decision, diskState }) => {
        if (decision.kind === 'kept') {
          return true;
        }
        return updateSessionMountLifecycle({
          db: tauriDatabase,
          sessionId,
          mountId,
          worktreePath: null,
          isAttached: false,
          diskState,
          expectedRevision: view.revision,
          updatedAt: new Date().toISOString() as IsoDateTime,
        });
      },
    });
    const decision = cleanup.decision;
    switch (decision.kind) {
      case 'failed':
      case 'kept':
        return { kind: decision.kind, reason: decision.reason };
      case 'removed':
      case 'missing':
        break;
      default: {
        const exhaustive: never = decision;
        throw exhaustive;
      }
    }
    const nextViews = await loadMountViews({ get, sessionId });
    applyMountViews({ set, sessionId, views: nextViews });
    await announceWorktreesChanged({ get, repoRoots: [view.repoRoot] });
    void get()
      .reconcileOrphanWorktrees()
      .catch(() => undefined);
    return { kind: decision.kind, reason: null };
  };
};
