import type { Agent } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { autoTreeWordOf } from '../../auto/autoTreeWordOf';

const loading = new Set<string>();

type Params = {
  readonly state: AppStore;
};

type AskParams = {
  readonly state: AppStore;
  readonly agent: Agent;
};

const isAskingLead = ({ state, agent }: AskParams): boolean =>
  (state.autoTreeViews[agent.sessionId] ?? []).some(
    (view) =>
      view.tree.rootAgentId === agent.id &&
      autoTreeWordOf({ view, rootTurn: state.agentTurnState[agent.id] ?? null }).state === 'asking',
  );

export const preloadAskTranscripts = ({ state }: Params): void => {
  for (const [sessionId, agents] of Object.entries(state.sessionPhaseRuns)) {
    for (const agent of agents) {
      const isBlocked = state.agentTurnState[agent.id]?.kind === 'blocked';
      const isAsking = isAskingLead({ state, agent });
      if (
        (!isBlocked && !isAsking) ||
        state.transcripts[agent.id] !== undefined ||
        loading.has(agent.id)
      ) {
        continue;
      }
      loading.add(agent.id);
      const session = sessionById(state.sessions, sessionId);
      if (session === undefined) {
        loading.delete(agent.id);
        continue;
      }
      void state
        .loadAgentTranscript(session.id, agent.id, { isSelecting: false, isMarkingViewed: false })
        .catch((error: unknown) => console.error('[companion] ask transcript failed', error))
        .finally(() => loading.delete(agent.id));
    }
  }
};
