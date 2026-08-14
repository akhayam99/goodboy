import {
  deletePendingResolution,
  listPendingResolutionsForSession,
  queuePendingResolution,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type {
  AgentId,
  PendingResolution,
  PendingResolutionOutcome,
  SessionId,
} from '@goodboy/types';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { closedThreadIds } from '../../../features/session/closedThreadIds';
import { resolverThreadSettlements } from '../../../features/session/resolverThreadSettlements';
import type { ResolverThreadSettlement } from '../../../features/session/resolverThreadSettlements';
import { tauriDatabase } from '../../../shared/lib/db';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import { withResolutionLock } from './withResolutionLock';
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
  readonly outcome: PendingResolutionOutcome;
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
  return async (sessionId: SessionId, agentId: AgentId): Promise<boolean> =>
    withResolutionLock<boolean>({
      sessionId,
      onBusy: () => {
        void get().emitNotification(
          'error',
          'warning',
          'resolve already running',
          'another resolve is still working on this session, so these threads were left alone.',
          { sessionId },
        );
        return false;
      },
      run: async () => {
        const agent = get().sessionPhaseRuns[sessionId]?.find(
          (candidate) => candidate.id === agentId,
        );
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
        const workspace =
          session !== undefined
            ? get().workspaces.find((candidate) => candidate.id === session.workspaceId)
            : undefined;
        const notifyTarget = {
          sessionId,
          ...(workspace !== undefined && { workspaceId: workspace.id }),
        };
        const outcomes = get().resolverThreadOutcomes[agentId] ?? {};
        let persisted: ReadonlyArray<PendingResolution>;
        try {
          persisted = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
        } catch (err) {
          void get().emitNotification(
            'error',
            'error',
            "couldn't read the comment queue, threads left open",
            formatError(err),
            { ...notifyTarget, action: { kind: 'retry-push-resolutions', sessionId } },
          );
          return false;
        }
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
            {
              threadId: settlement.threadId,
              closure,
              shouldPush: settlement.kind === 'resolved',
              outcome: settlement.kind,
            },
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
        const prNumber = get().sessionGithub[sessionId]?.pr?.number ?? null;
        let closed = 0;
        let failed = 0;
        let lastError = '';
        for (const target of targets) {
          try {
            const existing = persisted.find(
              (resolution) => resolution.threadId === target.threadId,
            );
            const replyAlreadyPosted = existing?.replyPostedAt != null;
            if (existing === undefined && prNumber !== null) {
              await queuePendingResolution({
                db: tauriDatabase,
                id: crypto.randomUUID(),
                sessionId,
                prNumber,
                threadId: target.threadId,
                commitSha: target.closure.commitSha ?? '',
                reply: target.closure.reply ?? null,
                outcome: target.outcome,
              });
            }
            await markThreadResolvedNoPush({
              set,
              get,
              sessionId,
              threadId: target.threadId,
              replyAlreadyPosted,
              closure: target.closure,
            });
            await deletePendingResolution({
              db: tauriDatabase,
              sessionId,
              threadId: target.threadId,
            });
            closed += 1;
          } catch (error) {
            failed += 1;
            lastError = formatError(error);
          }
        }
        try {
          const pending = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
          set((state) => ({
            sessionPendingResolutions: {
              ...state.sessionPendingResolutions,
              [sessionId]: pending,
            },
          }));
          await get().refreshSessionPrDetail(sessionId, { force: true });
        } catch (error) {
          void get().emitNotification(
            'error',
            'warning',
            'the pending list is stale',
            formatError(error),
            notifyTarget,
          );
        }
        if (failed > 0) {
          void get().emitNotification(
            'error',
            closed === 0 ? 'error' : 'warning',
            `${failed} thread${failed === 1 ? '' : 's'} failed to close`,
            `${closed} closed on GitHub. ${lastError}`,
            notifyTarget,
          );
        }
        if (skipped > 0) {
          void get().emitNotification(
            'error',
            'warning',
            `${skipped} thread${skipped === 1 ? '' : 's'} left open`,
            'they carry no resolution yet, so only the settled threads were closed on GitHub',
            notifyTarget,
          );
        }
        return failed === 0;
      },
    });
};
