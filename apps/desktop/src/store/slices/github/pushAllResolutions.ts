import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import { resolverOutcomeForThread } from './resolverOutcomeForThread';
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

    const pending = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
    if (pending.length === 0) {
      return { pushed: false, resolved: 0, failed: 0 };
    }

    const inMemoryOutcomes = pending.map((resolution) =>
      resolverOutcomeForThread({
        outcomes: get().resolverThreadOutcomes,
        threadId: resolution.threadId,
      }),
    );
    const shouldPush = pending.some((resolution, index) => {
      const outcome = inMemoryOutcomes[index];
      return (outcome?.kind ?? resolution.outcome ?? 'resolved') === 'resolved';
    });
    if (shouldPush) {
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
    }

    let resolved = 0;
    let failed = 0;
    let lastError = '';
    for (const [index, resolution] of pending.entries()) {
      try {
        const inMemoryOutcome = inMemoryOutcomes[index];
        const outcome = inMemoryOutcome?.kind ?? resolution.outcome ?? 'resolved';
        if (outcome === 'resolved') {
          await markThreadResolvedNoPush(set, get, sessionId, resolution.threadId, {
            commitSha: resolution.commitSha,
            reply: resolution.reply ?? undefined,
          });
        }
        if (outcome === 'wontfix') {
          await markThreadResolvedNoPush(set, get, sessionId, resolution.threadId, {
            reason: inMemoryOutcome?.kind === 'wontfix' ? inMemoryOutcome.reason : undefined,
            reply: resolution.reply ?? undefined,
          });
        }
        if (outcome === 'analyzed') {
          await markThreadResolvedNoPush(set, get, sessionId, resolution.threadId, {
            reply: resolution.reply ?? undefined,
          });
        }
        await deletePendingResolution({
          db: tauriDatabase,
          sessionId,
          threadId: resolution.threadId,
        });
        resolved += 1;
      } catch (err) {
        failed += 1;
        lastError = formatError(err);
      }
    }

    const rows = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
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
    return { pushed: shouldPush, resolved, failed };
  };
};
