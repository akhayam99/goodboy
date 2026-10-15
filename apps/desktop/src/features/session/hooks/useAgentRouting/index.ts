import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import type { PickedRoute } from '../../../../shared/components/RoutingPicker/PickedRoute';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import { KIND_TO_ROLE, type AgentKind, type AgentKindRouting } from '../../agent-kind';
import { isSameRouting } from '../../isSameRouting';
import { resolveSpawnRouting } from '../../spawn-routing';
import { useSuggestedRouting } from '../useSuggestedRouting';

const CHAT_ROUTING_REASON = 'Same model as this chat.';

type Params = {
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
};

export type AgentRoutingChoice = {
  readonly routing: AgentKindRouting | null;
  readonly effective: AgentKindRouting;
  readonly suggestion: AgentKindRouting;
  readonly suggestionReason: string;
  readonly lastUsed: AgentKindRouting | null;
  readonly pick: (route: PickedRoute) => void;
  readonly pickLastUsed: () => void;
  readonly reset: () => void;
};

export const useAgentRouting = ({ sessionId, kind }: Params): AgentRoutingChoice => {
  const [routing, setRouting] = useState<AgentKindRouting | null>(null);
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const roleDefault = useKindRouting({ sessionId, kind });
  const spawnDefault = resolveSpawnRouting({ kind, roleDefault, session });
  const suggested = useSuggestedRouting({ sessionId, role: KIND_TO_ROLE[kind] });
  const suggestion: AgentKindRouting = {
    provider: spawnDefault.provider,
    model: spawnDefault.model,
    effort: spawnDefault.effort,
  };
  const suggestionReason = spawnDefault.origin === 'chat' ? CHAT_ROUTING_REASON : suggested.reason;
  const lastAgent = useAppStore(
    (state) =>
      [...(state.sessionPhaseRuns[sessionId] ?? [])]
        .reverse()
        .find(
          (agent) =>
            agent.kind === kind && agent.providerOverride != null && agent.modelOverride != null,
        ) ?? null,
  );
  const lastRouting: AgentKindRouting | null =
    lastAgent?.providerOverride == null || lastAgent.modelOverride == null
      ? null
      : {
          provider: lastAgent.providerOverride,
          model: lastAgent.modelOverride,
          effort: lastAgent.effort ?? suggestion.effort,
        };
  const lastUsed =
    lastRouting !== null && !isSameRouting({ left: lastRouting, right: suggestion })
      ? lastRouting
      : null;

  return {
    routing,
    effective: routing ?? suggestion,
    suggestion,
    suggestionReason,
    lastUsed,
    pick: ({ provider, model, effort }) => {
      if (provider === '') {
        setRouting(null);
        return;
      }
      setRouting((current) => ({ ...(current ?? spawnDefault), provider, model, effort }));
    },
    pickLastUsed: () => setRouting(lastUsed),
    reset: () => setRouting(null),
  };
};
