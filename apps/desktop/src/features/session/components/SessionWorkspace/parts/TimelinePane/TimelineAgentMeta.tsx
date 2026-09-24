import { WorkMeta, formatUsd } from '@goodboy/ui';
import type { Agent, EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { RoutingBadge } from '../../../../../../shared/components/RoutingBadge';
import { useAppStore, useExecutedAgentRouting } from '../../../../../../store';
import type { AgentKind } from '../../../../agent-kind';
import { agentRowRouting } from '../../../../timeline/agentRowRouting';

type Props = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly step: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
  readonly shouldKeepCost: boolean;
};

export const TimelineAgentMeta = ({
  agent,
  kind,
  step,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
  shouldKeepCost,
}: Props) => {
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
  return (
    <WorkMeta
      isPlanned={routing.isPlanned}
      shouldKeepCost={shouldKeepCost}
      routing={
        <RoutingBadge
          variant="bare"
          provider={routing.provider}
          model={routing.model}
          effort={routing.effort}
          planned={routing.isPlanned ? null : routing.planned}
        />
      }
      cost={costUsd > 0 ? formatUsd(costUsd) : null}
    />
  );
};
