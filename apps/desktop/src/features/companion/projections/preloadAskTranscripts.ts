import type { AppStore } from '../../../store/store';

const loading = new Set<string>();

type Params = {
  readonly state: AppStore;
};

export const preloadAskTranscripts = ({ state }: Params): void => {
  for (const [sessionId, agents] of Object.entries(state.sessionPhaseRuns)) {
    for (const agent of agents) {
      const isBlocked = state.agentTurnState[agent.id]?.kind === 'blocked';
      if (!isBlocked || state.transcripts[agent.id] !== undefined || loading.has(agent.id)) {
        continue;
      }
      loading.add(agent.id);
      const session = state.sessions.find((candidate) => candidate.id === sessionId);
      if (session === undefined) {
        loading.delete(agent.id);
        continue;
      }
      void state
        .loadAgentTranscript(session.id, agent.id, { isSelecting: false })
        .catch((error: unknown) => console.error('[companion] ask transcript failed', error))
        .finally(() => loading.delete(agent.id));
    }
  }
};
