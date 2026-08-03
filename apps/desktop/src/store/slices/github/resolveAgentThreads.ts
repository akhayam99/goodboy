import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { closedThreadIds } from '../../../features/session/closedThreadIds';
import { resolverThreadSettlements } from '../../../features/session/resolverThreadSettlements';
import type { ResolverThreadSettlement } from '../../../features/session/resolverThreadSettlements';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import type { GetFn, SetFn } from './types';

type Closure = {
  readonly commitSha?: string;
  readonly reason?: string;
  readonly reply?: string;
};

type Target = {
  readonly threadId: string;
  readonly closure: Closure;
  readonly shouldPush: boolean;
};

type ClosureParams = {
  readonly settlement: ResolverThreadSettlement;
};

const settlementClosure = ({ settlement }: ClosureParams): Closure => ({
  ...(settlement.commitSha !== null && { commitSha: settlement.commitSha }),
  ...(settlement.reason !== null && { reason: settlement.reason }),
  ...(settlement.reply !== null && { reply: settlement.reply }),
});

const hasContent = ({ closure }: { readonly closure: Closure }): boolean =>
  closure.commitSha !== undefined || closure.reason !== undefined || closure.reply !== undefined;

export const resolveAgentThreads = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId): Promise<boolean> => {
    const agent = get().sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId);
    if (agent === undefined) {
      void get().emitNotification(
        'error',
        'error',
        'resolve threads failed',
        'the resolver is no longer loaded, so its threads were left open',
        { sessionId },
      );
      return false;
    }
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const workspace = session
      ? get().workspaces.find((candidate) => candidate.id === session.workspaceId)
      : undefined;
    const notifyTarget = {
      sessionId,
      ...(workspace !== undefined && { workspaceId: workspace.id }),
    };
    const outcomes = get().resolverThreadOutcomes[agentId] ?? {};
    const persisted = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
    const threadIds = [...new Set([...agentThreadIds(agent), ...Object.keys(outcomes)])];
    if (threadIds.length === 0) {
      void get().emitNotification(
        'error',
        'error',
        'nothing to resolve',
        'this resolver owns no review thread, so nothing was closed on GitHub',
        notifyTarget,
      );
      return false;
    }
    const settlements = resolverThreadSettlements({
      threadIds,
      outcomes,
      pendingResolutions: persisted,
      closedThreadIds: closedThreadIds({
        comments: get().sessionGithub[sessionId]?.detail?.comments ?? [],
        ledger: get().sessionResolvedThreads[sessionId] ?? [],
      }),
    });
    const targets = settlements.flatMap((settlement): ReadonlyArray<Target> => {
      if (settlement.isClosed || settlement.kind === 'open') {
        return [];
      }
      const closure = settlementClosure({ settlement });
      if (!hasContent({ closure })) {
        return [];
      }
      return [
        { threadId: settlement.threadId, closure, shouldPush: settlement.kind === 'resolved' },
      ];
    });
    const alreadyClosed = settlements.filter((settlement) => settlement.isClosed).length;
    const skipped = threadIds.length - targets.length - alreadyClosed;
    if (targets.length === 0) {
      void get().emitNotification(
        'error',
        'error',
        'nothing to resolve',
        skipped === 0
          ? 'every thread of this resolver is already closed on GitHub'
          : 'no thread of this resolver carries a resolution yet, so nothing was closed on GitHub',
        notifyTarget,
      );
      return false;
    }
    const shouldPush = targets.some((target) => target.shouldPush);
    if (shouldPush) {
      const push = await pushSessionBranch(get, sessionId);
      if (!push.ok) {
        void get().emitNotification(
          'error',
          'error',
          'push failed, threads left open',
          push.error,
          notifyTarget,
        );
        return false;
      }
    }
    try {
      for (const target of targets) {
        await markThreadResolvedNoPush(set, get, sessionId, target.threadId, target.closure);
        await deletePendingResolution({
          db: tauriDatabase,
          sessionId,
          threadId: target.threadId,
        });
      }
      const pending = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
      set((state) => ({
        sessionPendingResolutions: {
          ...state.sessionPendingResolutions,
          [sessionId]: pending,
        },
      }));
      await get().refreshSessionPrDetail(sessionId, { force: true });
      if (skipped > 0) {
        void get().emitNotification(
          'error',
          'warning',
          `${skipped} thread${skipped === 1 ? '' : 's'} left open`,
          'they carry no resolution yet, so only the settled threads were closed on GitHub',
          notifyTarget,
        );
      }
      return true;
    } catch (error) {
      void get().emitNotification(
        'error',
        'error',
        'resolve threads failed',
        formatError(error),
        notifyTarget,
      );
      return false;
    }
  };
};
