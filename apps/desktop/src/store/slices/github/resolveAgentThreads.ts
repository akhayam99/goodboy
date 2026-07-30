import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { AgentId, PendingResolution, SessionId } from '@goodboy/types';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import type { ResolverThreadOutcome } from '../../types';
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

type OutcomeClosureParams = {
  readonly outcome: ResolverThreadOutcome;
};

const outcomeClosure = ({ outcome }: OutcomeClosureParams): Closure => {
  if (outcome.kind === 'resolved') {
    return { commitSha: outcome.commitSha, reply: outcome.reply };
  }
  if (outcome.kind === 'wontfix') {
    return { reason: outcome.reason, reply: outcome.reply };
  }
  return { reply: outcome.reply };
};

type PendingClosureParams = {
  readonly resolution: PendingResolution;
};

const pendingClosure = ({ resolution }: PendingClosureParams): Closure => {
  if ((resolution.outcome ?? 'resolved') === 'resolved') {
    return {
      commitSha: resolution.commitSha,
      ...(resolution.reply !== null && { reply: resolution.reply }),
    };
  }
  return {
    ...(resolution.reply !== null && { reply: resolution.reply }),
  };
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
    const persisted = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
    const persistedByThreadId = new Map(
      persisted.map((resolution) => [resolution.threadId, resolution] as const),
    );
    const threadIds = new Set([...agentThreadIds(agent), ...Object.keys(outcomes)]);
    const targets = [...threadIds].map((threadId): Target => {
      const outcome = outcomes[threadId];
      if (outcome !== undefined) {
        return {
          threadId,
          closure: outcomeClosure({ outcome }),
          shouldPush: outcome.kind === 'resolved',
        };
      }
      const resolution = persistedByThreadId.get(threadId);
      if (resolution !== undefined) {
        return {
          threadId,
          closure: pendingClosure({ resolution }),
          shouldPush: (resolution.outcome ?? 'resolved') === 'resolved',
        };
      }
      return {
        threadId,
        closure: {},
        shouldPush: outcomeEntries.length === 0,
      };
    });
    if (targets.length === 0) {
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
