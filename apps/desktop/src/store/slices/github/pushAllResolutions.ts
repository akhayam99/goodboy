import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import type { GetFn, SetFn } from './types';

export type PushAllResult = {
  pushed: boolean;
  resolved: number;
  failed: number;
};

export const pushAllResolutions = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<PushAllResult> => {
    const session = get().sessions.find((s) => s.id === sessionId);
    const workspace = session
      ? get().workspaces.find((w) => w.id === session.workspaceId)
      : undefined;
    const notifyTarget = { sessionId, ...(workspace && { workspaceId: workspace.id }) };

    const pending = await listPendingResolutionsForSession(tauriDatabase, sessionId);
    if (pending.length === 0) {
      return { pushed: false, resolved: 0, failed: 0 };
    }

    const push = await pushSessionBranch(get, sessionId);
    if (!push.ok) {
      void get().emitNotification(
        'error',
        'error',
        'push failed, comments left unresolved',
        push.error,
        notifyTarget,
      );
      return { pushed: false, resolved: 0, failed: pending.length };
    }

    let resolved = 0;
    let failed = 0;
    let lastError = '';
    for (const p of pending) {
      try {
        await markThreadResolvedNoPush(get, sessionId, p.threadId, { commitSha: p.commitSha });
        await deletePendingResolution(tauriDatabase, sessionId, p.threadId);
        resolved += 1;
      } catch (err) {
        failed += 1;
        lastError = formatError(err);
      }
    }

    const rows = await listPendingResolutionsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
    }));
    await get().refreshSessionPrDetail(sessionId, { force: true });

    if (failed > 0) {
      void get().emitNotification(
        'error',
        failed === pending.length ? 'error' : 'warning',
        `pushed, but ${failed} comment${failed === 1 ? '' : 's'} failed to resolve`,
        lastError || 'the branch was pushed; retry to resolve the remaining threads',
        notifyTarget,
      );
    }
    return { pushed: true, resolved, failed };
  };
};
