import type { Agent, EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { estimateKeyOf, workEstimateFor } from '../../workTreeModel/agentWorkTime';
import type { WorkEstimate } from '../../workTreeModel/workTime';
import type { WorkTimeSource } from '../../workTreeModel/workTimeSource';
import { KIND_TO_ROLE, kindForRole, type AgentKind } from '../agent-kind';
import { agentRowRouting } from './agentRowRouting';

type Params = {
  readonly step: Step;
  readonly agent: Agent | null;
  readonly kind: AgentKind | null;
  readonly source: WorkTimeSource;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

export const stepWorkEstimate = ({
  step,
  agent,
  kind,
  source,
  roleModels,
  sessionProvider,
  sessionEffort,
}: Params): WorkEstimate | null => {
  const stepKind = kind ?? kindForRole({ role: step.role ?? 'custom' });
  const routing = agentRowRouting({
    executed: null,
    step,
    kind: stepKind,
    roleModels,
    providerOverride: agent?.providerOverride ?? null,
    modelOverride: agent?.modelOverride ?? null,
    effortOverride: agent?.effort ?? null,
    sessionProvider,
    sessionEffort,
  });
  return workEstimateFor({
    key: estimateKeyOf({
      role: step.role ?? KIND_TO_ROLE[stepKind],
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
      size: step.size ?? null,
    }),
    unit: 'step',
    source,
  });
};
