import { Divider, ScrollFade } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { InspectorHeader } from '../SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { AgentHeaderActions } from './AgentHeaderActions';
import { CostsSection } from './CostsSection';
import { IdentitySection } from './IdentitySection';

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
      <InspectorHeader
        title={agent.name}
        closeLabel="close agent inspector"
        actions={
          <AgentHeaderActions
            agent={agent}
            sessionId={sessionId}
            allowInterrupt
            onDeleted={onClose}
          />
        }
        onClose={onClose}
      />
      <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.rail.body}>
        <div className="flex flex-col gap-4">
          <IdentitySection
            agent={agent}
            kind={kind}
            provider={telemetry?.provider ?? providerOverride}
            model={telemetry?.model ?? modelOverride}
            effort={effortOverride}
          />
          <Divider />
          <CostsSection
            aggregate={metrics.aggregatesByAgentId.get(agentId) ?? null}
            contextUsage={metrics.providerUsageByAgentId.get(agentId) ?? EMPTY_ARRAY}
            turns={metrics.turnsByAgentId.get(agentId) ?? 0}
          />
        </div>
      </ScrollFade>
    </div>
  );
};
