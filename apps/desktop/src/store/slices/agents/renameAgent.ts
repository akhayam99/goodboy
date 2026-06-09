import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export const renameAgent = (set: SetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    await tauriDatabase.execute('UPDATE agents SET name = ? WHERE id = ?', [trimmed, agentId]);
    const refreshed = await invokeAgentList(sessionId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
    }));
  };
};
