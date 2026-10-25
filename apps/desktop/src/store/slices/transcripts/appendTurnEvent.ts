import type { AgentId, SessionId, TurnEvent } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { invokeAgentSetProviderSessionId } from '../../../features/workflows/workflows';
import { purgedAgentIds } from '../sessions/sessionMutators';
import { bufferTurnEvent } from './buffer';
import { queueTurnEventInsert } from './queue';
import { turnEventIds } from './turnEventIds';
import type { SetFn } from './types';

export const appendTurnEvent = (set: SetFn) => {
  return (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => {
    if (purgedAgentIds.has(agentId)) {
      return;
    }
    const storedId = queueTurnEventInsert({
      id: crypto.randomUUID(),
      sessionId,
      agentId,
      event,
    });
    turnEventIds.set(event, storedId);
    bufferTurnEvent({ set, agentId, sessionId, event });

    if (event.kind === 'provider_session_init' && event.provider !== undefined) {
      void invokeAgentSetProviderSessionId({
        id: agentId,
        providerSessionId: event.providerSessionId,
        providerSessionProviderId: event.provider,
      }).catch((err) => {
        if (import.meta.env.DEV) {
          const message = formatError(err);
          console.warn(`[turn-events] persist provider_session_id failed: ${message}`);
        }
      });
    }
  };
};
