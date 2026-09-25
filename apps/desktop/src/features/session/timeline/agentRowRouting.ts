import type { EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import type { ExecutedAgentRouting } from '../../../store/slices/turn/executedAgentRouting';
import { EFFORT_LEVELS } from '../../chat/utils/chat-constants';
import { resolveStepRouting } from '../../workflows/resolveStepRouting';
import type { AgentKind } from '../agent-kind';

type PlannedRowRouting = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
};

export type AgentRowRouting = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
  readonly isEffortObserved: boolean;
  readonly planned: PlannedRowRouting | null;
  readonly isPlanned: boolean;
};

type Params = {
  readonly executed: ExecutedAgentRouting | null;
  readonly step: Step | null;
  readonly kind: AgentKind;
  readonly roleModels: RoleModelPreferences | null;
  readonly providerOverride: ProviderId | null;
  readonly modelOverride: string | null;
  readonly effortOverride: EffortLevel | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

export const agentRowRouting = ({
  executed,
  step,
  kind,
  roleModels,
  providerOverride,
  modelOverride,
  effortOverride,
  sessionProvider,
  sessionEffort,
}: Params): AgentRowRouting => {
  const observedEffort = EFFORT_LEVELS.find((level) => level === executed?.effort) ?? null;
  if (step == null) {
    const planned =
      providerOverride != null || modelOverride != null || effortOverride != null
        ? { provider: providerOverride, model: modelOverride, effort: effortOverride }
        : null;
    return {
      provider: executed?.provider ?? providerOverride,
      model: executed?.model ?? modelOverride,
      effort: observedEffort ?? effortOverride,
      isEffortObserved: observedEffort != null,
      planned,
      isPlanned: executed == null,
    };
  }
  const routing = resolveStepRouting({
    step,
    kind,
    roleModels,
    agentModel: modelOverride,
    agentProvider: providerOverride,
    agentEffort: effortOverride,
    sessionProvider,
    sessionEffort,
  });
  return {
    provider: executed?.provider ?? routing.provider,
    model: executed?.model ?? routing.model,
    effort: observedEffort ?? routing.effort,
    isEffortObserved: observedEffort != null,
    planned: { provider: routing.provider, model: routing.model, effort: routing.effort },
    isPlanned: executed == null,
  };
};
