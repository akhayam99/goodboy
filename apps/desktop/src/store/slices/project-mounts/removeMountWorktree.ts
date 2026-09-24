import { updateSessionMountLifecycle } from '@goodboy/db';
import type {
  IsoDateTime,
  MountCleanupDecision,
  MountId,
  SessionId,
  WorktreeRemovalMode,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import { requireMountContext } from './requireMountContext';
import { runMountRemoval } from './runMountRemoval';
import type { GetFn, SetFn } from './types';

export type RemoveMountWorktreeInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly mode: WorktreeRemovalMode;
};

export type RemoveMountWorktreeResult = {
  readonly kind: MountCleanupDecision['kind'];
  readonly reason: string | null;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const removeMountWorktree = ({ set, get }: Params) => {
  return async ({
    sessionId,
    mountId,
    mode,
  }: RemoveMountWorktreeInput): Promise<RemoveMountWorktreeResult> => {
    const views = await loadMountViews({ get, sessionId });
    const view = requireMountView({ views, mountId });
    const { project } = requireMountContext({ get, sessionId, projectId: view.projectId });
    const worktreePath = view.worktreePath;
    if (worktreePath === null) {
      return { kind: 'missing', reason: null };
    }
    const cleanup = await runMountRemoval({
      get,
      mode,
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: view.revision,
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
    void get()
      .reconcileOrphanWorktrees()
      .catch(() => undefined);
    return { kind: decision.kind, reason: null };
  };
};
