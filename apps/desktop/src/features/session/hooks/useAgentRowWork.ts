import type { Agent, EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../store';
import { useAgentWorkTime } from '../../workTreeModel/hooks/useAgentWorkTime';
import type { RowPhase } from '../../workTreeModel/rowState';
import type { WorkTime } from '../../workTreeModel/workTime';
import { KIND_TO_ROLE, type AgentKind } from '../agent-kind';
import { agentRowRouting, type AgentRowRouting } from '../timeline/agentRowRouting';

type Params = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly step: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly phase: RowPhase;
};

export type AgentRowWork = {
  readonly routing: AgentRowRouting;
  readonly time: WorkTime | null | undefined;
};

export const useAgentRowWork = ({
  agent,
  kind,
  step,
  roleModels,
  sessionProvider,
  sessionEffort,
  phase,
}: Params): AgentRowWork => {
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride[agent.id] ?? agent.effort ?? null,
  );
  const executed = useExecutedAgentRouting({ agent });
  const routing = agentRowRouting({
    executed,
    step,
    kind,
    roleModels,
    providerOverride,
    modelOverride,
    effortOverride,
    sessionProvider,
    sessionEffort,
  });
  const time = useAgentWorkTime({
    agentId: agent.id,
    role: step?.role ?? KIND_TO_ROLE[kind],
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    size: step?.size ?? null,
    unit: step === null ? 'turn' : 'step',
    phase,
  });
  return { routing, time };
};
