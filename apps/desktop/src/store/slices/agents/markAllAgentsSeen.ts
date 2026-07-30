import type { IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';
import { agentHasUnread } from './agentHasUnread';

export const markAllAgentsSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const unreadAgents = (get().sessionPhaseRuns[sessionId] ?? []).filter((agent) =>
      agentHasUnread(agent, false),
    );
    if (unreadAgents.length === 0) {
      return;
    }

    const stampedAt = new Date().toISOString() as IsoDateTime;
    const unreadAgentIds = new Set(unreadAgents.map((agent) => agent.id));
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          unreadAgentIds.has(agent.id) ? { ...agent, lastViewedAt: stampedAt } : agent,
        ),
      },
    }));
    await Promise.all(
      unreadAgents.map((agent) =>
        invokeAgentMarkViewed(agent.id, stampedAt).catch(() => undefined),
      ),
    );
    void get().refreshUnreadWorkspaces();
  };
};
