import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
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
};

export const resolveAgentThreads = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId): Promise<boolean> => {
    const agent = get().sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId);
    if (agent === undefined) {
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
    const outcomeEntries = Object.entries(outcomes);
    const targets =
      outcomeEntries.length > 0
        ? outcomeEntries.map(([threadId, outcome]): Target => {
            if (outcome.kind === 'resolved') {
              return {
                threadId,
                closure: { commitSha: outcome.commitSha, reply: outcome.reply },
              };
            }
            if (outcome.kind === 'wontfix') {
              return {
                threadId,
                closure: { reason: outcome.reason, reply: outcome.reply },
              };
            }
            return { threadId, closure: { reply: outcome.reply } };
          })
        : agentThreadIds(agent).map((threadId): Target => ({ threadId, closure: {} }));
    if (targets.length === 0) {
      return false;
    }
    const shouldPush =
      outcomeEntries.length === 0 ||
      outcomeEntries.some(([, outcome]) => outcome.kind === 'resolved');
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
        await markThreadResolvedNoPush(get, sessionId, target.threadId, target.closure);
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
