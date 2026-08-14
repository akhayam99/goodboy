import type { AgentId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { invokeAgentSetDone } from '../../../features/workflows/workflows';
import { applyAgentDone } from './applyAgentDone';
import type { GetFn, SetFn } from './types';

export const clearAgentDone = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const previousDoneAt =
      get().sessionPhaseRuns[sessionId]?.find((agent) => agent.id === agentId)?.doneAt ?? null;
    applyAgentDone({ set, sessionId, agentId, doneAt: null });
    try {
      await invokeAgentSetDone(agentId, false, null);
    } catch (error) {
      applyAgentDone({ set, sessionId, agentId, doneAt: previousDoneAt });
      void get().emitNotification(
        'error',
        'error',
        'could not reopen this agent',
        formatError(error),
        { sessionId },
      );
      return;
    }
    applyAgentDone({ set, sessionId, agentId, doneAt: null });
  };
};
