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
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title: "Couldn't reopen this agent",
        body: formatError(error),
        sessionId,
      });
      return;
    }
    applyAgentDone({ set, sessionId, agentId, doneAt: null });
  };
};
