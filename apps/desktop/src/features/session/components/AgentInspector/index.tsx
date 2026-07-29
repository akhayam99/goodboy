import { Divider, ScrollFade } from '@goodboy/ui';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { InspectorHeader } from '../SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { ActionsSection } from './ActionsSection';
import { CostsSection } from './CostsSection';
import { IdentitySection } from './IdentitySection';
import { ResolverSections } from './ResolverSections';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly onClose?: () => void;
};

export const AgentInspector = ({ sessionId, agentId, onClose }: Props) => {
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (candidate) => candidate.id === agentId,
      ) ?? null,
  );
  const kindOverride = useAppStore((state) => state.agentKindOverride?.[agentId] ?? null);
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride?.[agentId] ?? agent?.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride?.[agentId] ?? agent?.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride?.[agentId] ?? agent?.effort ?? null,
  );
  const metrics = useAgentMetrics({ sessionId });

  if (agent === null) {
    return null;
  }

  const telemetry = metrics.latestTelemetryByAgentId.get(agentId) ?? null;
  const kind = classifyAgent(agent, kindOverride);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InspectorHeader title={agent.name} closeLabel="close agent inspector" onClose={onClose} />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-4">
          <IdentitySection
            agent={agent}
            kind={kind}
            provider={telemetry?.provider ?? providerOverride}
            model={telemetry?.model ?? modelOverride}
            effort={effortOverride}
          />
          <Divider />
          {kind === 'resolver' ? (
            <>
              <ResolverSections sessionId={sessionId} agent={agent} />
              <Divider />
            </>
          ) : null}
          <CostsSection
            aggregate={metrics.aggregatesByAgentId.get(agentId) ?? null}
            contextUsage={metrics.providerUsageByAgentId.get(agentId) ?? EMPTY_ARRAY}
            turns={metrics.turnsByAgentId.get(agentId) ?? 0}
          />
          <Divider />
          <ActionsSection agent={agent} sessionId={sessionId} onDeleted={onClose} />
        </div>
      </ScrollFade>
    </div>
  );
};
