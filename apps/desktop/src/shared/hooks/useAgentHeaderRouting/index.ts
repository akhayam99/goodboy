import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../store';
import { agentReferenceRouting } from '../../../store/slices/turn/agentReferenceRouting';
import { stepConfigForAgent } from '../../../store/slices/turn/stepConfigForAgent';
import { resolveSessionSettings } from '../../../store/slices/overrides/selectResolvedSettings';
import { useRoutingScope } from '../useRoutingScope';
import { classifyAgent } from '../../../features/session/agent-kind';
import { agentRowRouting } from '../../../features/session/timeline/agentRowRouting';
import { effectiveAgentStatus } from '../../../features/session/components/AgentDetailPane/agentNowState';
import { agentHeaderRouting, type AgentHeaderRouting } from './agentHeaderRouting';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
};

export const useAgentHeaderRouting = ({ session, agent }: Params): AgentHeaderRouting => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const status = effectiveAgentStatus({ agent, turnState });
  const isLive = status === 'running' || status === 'pending';
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride[agent.id] ?? agent.effort ?? null,
  );
  const roleModels = useAppStore(
    (state) => resolveSessionSettings({ state, session }).roleModels ?? null,
  );
  const workflows = useAppStore((state) => state.phaseTemplates[session.workspaceId] ?? null);
  const executed = useExecutedAgentRouting({ agent });
  const scope = useRoutingScope({ sessionId: session.id });
  return useMemo(() => {
    const kind = classifyAgent({ agent, override: kindOverride });
    const step = stepConfigForAgent({ agent, session, workflows });
    const row = agentRowRouting({
      executed,
      step,
      kind,
      roleModels,
      providerOverride,
      modelOverride,
      effortOverride,
      sessionProvider: session.providerPreference?.defaultProvider ?? null,
      sessionEffort: session.effort ?? null,
      scope,
    });
    const reference =
      row.model == null && isLive
        ? agentReferenceRouting({
            agent,
            stepConfig: step,
            roleModels,
            session,
            kindOverride,
            scope,
          })
        : null;
    return agentHeaderRouting({ row, reference, isLive });
  }, [
    agent,
    session,
    kindOverride,
    providerOverride,
    modelOverride,
    effortOverride,
    roleModels,
    workflows,
    executed,
    scope,
    isLive,
  ]);
};
