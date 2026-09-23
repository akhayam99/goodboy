import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { invokeAgentSetDone } from '../../../features/workflows/workflows';
import { applyAgentDone } from './applyAgentDone';
import type { GetFn, SetFn } from './types';

export const setAgentDone = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const doneAt = new Date().toISOString() as IsoDateTime;
    applyAgentDone({ set, sessionId, agentId, doneAt });
    try {
      await invokeAgentSetDone(agentId, true, doneAt);
    } catch (error) {
      applyAgentDone({ set, sessionId, agentId, doneAt: null });
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title: 'could not mark this agent done',
        body: formatError(error),
        sessionId,
      });
      return;
    }
    applyAgentDone({ set, sessionId, agentId, doneAt });
  };
};
