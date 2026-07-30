import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';
import { agentHasUnread } from './agentHasUnread';
import { stampAgentSubtreeViewed } from './stampAgentSubtreeViewed';

export const markAgentSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const stampedAt = new Date().toISOString() as IsoDateTime;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const stamp = stampAgentSubtreeViewed({
      runs,
      rootAgentId: agentId,
      stampedAt,
    });
    const hasUnread = runs.some((run) => stamp.agentIds.has(run.id) && agentHasUnread(run, false));
    if (!hasUnread) {
      return;
    }

    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: stampAgentSubtreeViewed({
          runs: state.sessionPhaseRuns[sessionId] ?? [],
          rootAgentId: agentId,
          stampedAt,
        }).runs,
      },
    }));
    await Promise.all(
      [...stamp.agentIds].map((id) => invokeAgentMarkViewed(id, stampedAt).catch(() => undefined)),
    );
    void get().refreshUnreadWorkspaces();
  };
};
