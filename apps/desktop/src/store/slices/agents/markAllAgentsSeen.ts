import type { IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import { announceSessionFact } from '../../../shared/lib/dataChanged/announceSessionFact';
import type { GetFn, SetFn } from './types';
import { agentHasUnread } from './agentHasUnread';
import { newestFinishedAtOf } from './newestFinishedAtOf';
import { seenReads } from './seenReads';

type Params = {
  readonly sessionId: SessionId;
  readonly seenUpTo?: IsoDateTime;
};

export const markAllAgentsSeen = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, seenUpTo }: Params): Promise<void> => {
    const unreadAgents = (get().sessionPhaseRuns[sessionId] ?? []).filter((agent) =>
      agentHasUnread(agent, false),
    );
    const upTo = seenUpTo ?? newestFinishedAtOf({ agents: unreadAgents });
    if (upTo === null) {
      return;
    }
    const targets = unreadAgents.filter(
      (agent) => agent.lastFinishedAt != null && agent.lastFinishedAt <= upTo,
    );
    if (targets.length === 0) {
      return;
    }

    const outcomes = await Promise.allSettled(
      targets.map((agent) => invokeAgentMarkViewed(agent.id, upTo)),
    );
    const seenIds = new Set(
      targets
        .filter((_, index) => outcomes[index]?.status === 'fulfilled')
        .map((agent) => agent.id),
    );
    if (seenIds.size > 0) {
      seenReads.cancel({ key: sessionId });
      set((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
            seenIds.has(agent.id) && agent.lastFinishedAt != null && agent.lastFinishedAt <= upTo
              ? {
                  ...agent,
                  lastViewedAt:
                    agent.lastViewedAt === undefined || agent.lastViewedAt < upTo
                      ? upTo
                      : agent.lastViewedAt,
                }
              : agent,
          ),
        },
      }));
      announceSessionFact({ kind: 'agent-seen', sessionId });
      void get().refreshUnreadWorkspaces();
    }

    const failure = outcomes.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    if (failure !== undefined) {
      await get().refreshAgentsSeen({ sessionId });
      throw failure.reason;
    }
  };
};
