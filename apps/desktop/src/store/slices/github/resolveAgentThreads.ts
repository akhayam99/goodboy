import { deletePendingResolution, listPendingResolutionsForSession } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import type { GetFn, SetFn } from './types';

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
    const resolvedEntries = Object.entries(outcomes).flatMap(([threadId, outcome]) =>
      outcome.kind === 'resolved' ? [{ threadId, commitSha: outcome.commitSha }] : [],
    );
    const targets =
      Object.keys(outcomes).length > 0
        ? resolvedEntries
        : agentThreadIds(agent).map((threadId) => ({ threadId, commitSha: null }));
    if (targets.length === 0) {
      return false;
    }
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
    try {
      for (const target of targets) {
        await markThreadResolvedNoPush(
          get,
          sessionId,
          target.threadId,
          target.commitSha !== null ? { commitSha: target.commitSha } : undefined,
        );
        await deletePendingResolution(tauriDatabase, sessionId, target.threadId);
      }
      const pending = await listPendingResolutionsForSession(tauriDatabase, sessionId);
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
