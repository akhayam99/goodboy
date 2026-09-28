import { useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionStageInfo } from '../../../../../store';
import { agentHomeLens, classifyAgent, resolveRootAgent } from '../../../agent-kind';
import { attentionAgentId, resolveAttentionTarget, type SessionAttention } from '../lib';

type Params = {
  readonly session: Session;
};

export const useAttentionTarget = ({ session }: Params): SessionAttention => {
  const sessionId = session.id as SessionId;
  const stage = useSessionStageInfo(session);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const blockedAgentId = useAppStore(
    (s) => agents.find((agent) => s.agentTurnState[agent.id]?.kind === 'blocked')?.id ?? null,
  );

  const target = useMemo(() => {
    const agentId = attentionAgentId({ stage, agents, blockedAgentId });
    if (agentId === null) {
      return resolveAttentionTarget({ stage, agent: null });
    }
    const root = resolveRootAgent({ agents, agentId }) ?? null;
    const home =
      root === null
        ? 'agents'
        : agentHomeLens({
            agent: root,
            kind: classifyAgent({ agent: root, override: agentKindOverride[root.id] ?? null }),
          });
    return resolveAttentionTarget({ stage, agent: { agentId, home } });
  }, [agentKindOverride, blockedAgentId, agents, stage]);

  return { stage, target };
};
