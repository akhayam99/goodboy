import { updateSessionMountLifecycle } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { forgetMount } from './forgetMount';
import { withoutMountBranchGone } from './mountBranchGone';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import { requireMountContext } from './requireMountContext';
import { nowIso } from './nowIso';
import { runMountRemoval } from './runMountRemoval';
import type { SliceDeps } from '../../slice-types';
import type { MountKeyInput } from './types';

export type RemoveGoneMountResult = {
  readonly kind: 'forgotten' | 'kept' | 'failed';
  readonly reason: string | null;
};

export const removeGoneMount = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<RemoveGoneMountResult> => {
    const view = requireMountView({ views: await loadMountViews({ get, sessionId }), mountId });
    const { project } = requireMountContext({ get, sessionId, projectId: view.projectId });
    const isOnDisk = view.diskState !== 'missing' && view.diskState !== 'removed';
    const folder = view.worktreePath ?? view.lastWorktreePath;
    if (isOnDisk && folder !== null && view.worktreePath === null) {
      const cleanup = await runMountRemoval({
        get,
        mode: 'safe',
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
            fresh.worktreePath === null &&
            !fresh.isAttached
          );
        },
        target: {
          sessionId,
          mountId,
          projectId: view.projectId,
          repoRoot: view.repoRoot,
          worktreePath: folder,
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
            updatedAt: nowIso({}),
          });
        },
      });
      if (cleanup.decision.kind === 'kept' || cleanup.decision.kind === 'failed') {
        return { kind: cleanup.decision.kind, reason: cleanup.decision.reason };
      }
      applyMountViews({ set, sessionId, views: await loadMountViews({ get, sessionId }) });
    }
    const settled = (await loadMountViews({ get, sessionId })).find(
      (candidate) => candidate.id === mountId,
    );
    try {
      await forgetMount(
        set,
        get,
      )({
        sessionId,
        mountId,
        expectedRevision: settled?.revision ?? view.revision,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'revision-conflict') {
        return { kind: 'kept', reason: 'the mount changed while waiting to remove it' };
      }
      throw error;
    }
    set((state) => ({
      mountBranchGone: withoutMountBranchGone({ gone: state.mountBranchGone, mountId }),
    }));
    return { kind: 'forgotten', reason: null };
  };
};
