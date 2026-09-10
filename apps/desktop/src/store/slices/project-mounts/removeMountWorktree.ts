import { updateSessionMountLifecycle } from '@goodboy/db';
import type {
  IsoDateTime,
  MountCleanupDecision,
  MountId,
  SessionId,
  WorktreeRemovalMode,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { cleanupMountDirectory } from '../mount-cleanup';
import { mountError } from './mountErrors';
import { withRepositoryAndMountLock } from './mountLocks';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import { requireMountContext } from './requireMountContext';
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
    return withRepositoryAndMountLock({
      repoRoot: view.repoRoot,
      mountKey: `${sessionId}:${mountId}`,
      run: async () => {
        const cleanup = await cleanupMountDirectory({
          get,
          mode,
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
        const written = await updateSessionMountLifecycle({
          db: tauriDatabase,
          sessionId,
          mountId,
          worktreePath: null,
          isAttached: false,
          diskState: cleanup.diskState,
          expectedRevision: view.revision,
          updatedAt: new Date().toISOString() as IsoDateTime,
        });
        if (!written) {
          throw mountError({
            code: 'revision-conflict',
            message: 'the mount changed while removing its worktree',
            mountId,
          });
        }
        const nextViews = await loadMountViews({ get, sessionId });
        applyMountViews({ set, sessionId, views: nextViews });
        void get()
          .reconcileOrphanWorktrees()
          .catch(() => undefined);
        return { kind: decision.kind, reason: null };
      },
    });
  };
};
