import { listenDataChanged } from '../../shared/lib/dataChanged';
import { useAppStore } from '../../store';

export const listenAgentTurnChanges = (): Promise<() => void> =>
  listenDataChanged({
    onChange: ({ kind, sessionId, agentId }) => {
      if (kind !== 'agent-turn') {
        return;
      }
      const state = useAppStore.getState();
      void state
        .refreshAgentAsks({ sessionId, agentId })
        .then(() => state.drainAgentQueue({ sessionId, agentId }));
    },
  });
