import type { EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import type { ExecutedAgentRouting } from '../../../store/slices/turn/executedAgentRouting';
import { resolveStepRouting } from '../../workflows/resolveStepRouting';
import type { AgentKind } from '../agent-kind';

export type AgentRowRouting = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
  readonly planned: { readonly provider: string | null; readonly model: string | null } | null;
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
  if (step == null) {
    const planned =
      providerOverride != null || modelOverride != null
        ? { provider: providerOverride, model: modelOverride }
        : null;
    return {
      provider: executed?.provider ?? providerOverride,
      model: executed?.model ?? modelOverride,
      effort: effortOverride,
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
    effort: routing.effort,
    planned: { provider: routing.provider, model: routing.model },
    isPlanned: executed == null,
  };
};
