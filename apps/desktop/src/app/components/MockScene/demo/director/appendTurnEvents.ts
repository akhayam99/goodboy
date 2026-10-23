import type { AgentId, TurnEvent } from '@goodboy/types';
import { agentLiveKey } from '../../../../../features/chat/reveal/agentLiveKey';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly agentId: AgentId;
  readonly events: ReadonlyArray<TurnEvent>;
};

export const appendTurnEvents = ({ store, agentId, events }: Params): void => {
  for (const event of events) {
    if (event.kind === 'assistant_text') {
      liveTextRegistry.mark({ runId: event.runId });
      liveTextRegistry.mark({ runId: agentLiveKey({ agentId }) });
    }
  }
  store.setState((state) => ({
    transcripts: {
      ...state.transcripts,
      [agentId]: [...(state.transcripts[agentId] ?? []), ...events],
    },
  }));
};
