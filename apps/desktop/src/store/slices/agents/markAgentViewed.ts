import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

export function markAgentViewed(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent?.lastFinishedAt) return;
    if (agent.lastViewedAt && agent.lastViewedAt >= agent.lastFinishedAt) return;

    const stampedAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((r) =>
          r.id === agentId ? { ...r, lastViewedAt: stampedAt } : r,
        ),
      },
    }));
    void invokeAgentMarkViewed(agentId, stampedAt).catch(() => undefined);
    void get().refreshUnreadWorkspaces();
  };
}
