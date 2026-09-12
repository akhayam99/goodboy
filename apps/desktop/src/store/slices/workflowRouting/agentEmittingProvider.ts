import type { AgentId, ProviderId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const agentEmittingProvider = ({ state, sessionId, agentId }: Params): ProviderId | null => {
  const agent = (state.sessionPhaseRuns?.[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  const pinned = (state.agentProviderOverride ?? {})[agentId] ?? agent?.providerOverride ?? null;
  if (pinned !== null) {
    return pinned;
  }
  const session = (state.sessions ?? []).find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return null;
  }
  const fallback = session.providerOverride ?? session.providerPreference?.defaultProvider ?? null;
  if (fallback === undefined || fallback === null) {
    return null;
  }
  return fallback as ProviderId;
};
