import type { SessionId } from '@goodboy/types';
import type { SignalQuietAgent } from './nextStepSignals';
import { QUIET_WINDOW_MS } from './signals/QUIET_WINDOW_MS';
import type { SessionSuggestion } from './types';

type AskAgent = Extract<SessionSuggestion, { readonly kind: 'ask-agent' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly quietAgents: ReadonlyArray<SignalQuietAgent>;
};

export const askAgentSuggestionsOf = ({
  sessionId,
  quietAgents,
}: Params): ReadonlyArray<AskAgent> =>
  quietAgents.flatMap((agent): ReadonlyArray<AskAgent> => {
    if (agent.quietMs < QUIET_WINDOW_MS.ask || agent.quietMs >= QUIET_WINDOW_MS.needsYou) {
      return [];
    }
    return [
      {
        id: `ask-agent:${agent.agentId}`,
        kind: 'ask-agent',
        priority: 15,
        band: 1,
        title: `Ask the ${agent.label} what blocks it`,
        detail: `Quiet for ${Math.floor(agent.quietMs / 60_000)} minutes`,
        sessionId,
        targetKey: `agent:${agent.agentId}`,
        fingerprint: `ask-agent:${agent.agentId}`,
        payload: { agentId: agent.agentId, agentLabel: agent.label, quietMs: agent.quietMs },
      },
    ];
  });
