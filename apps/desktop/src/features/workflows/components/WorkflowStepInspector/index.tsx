import { Divider, Markdown, ScrollFade } from '@goodboy/ui';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { stripControlMarkers } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { classifyAgent } from '../../../session/agent-kind';
import { useAgentMetrics } from '../../../session/hooks/useAgentMetrics';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { InspectorSection } from '../../../session/components/InspectorSection';
import { InspectorHeader } from '../../../session/components/SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { CostsSection } from '../../../session/components/AgentInspector/CostsSection';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { useAttachedWorkflowRuns } from '../../useAttachedWorkflowRuns';
import { isWorkflowStepAgent } from '../../isWorkflowStepAgent';
import { resolveStepRouting } from '../../resolveStepRouting';
import { roleModelsForSession } from '../../../../store/slices/overrides/roleModelsForSession';

type Props = {
  readonly session: Session;
  readonly agentId: AgentId;
};

export const WorkflowStepInspector = ({ session, agentId }: Props) => {
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (candidate) => candidate.id === agentId,
      ) ?? null,
  );
  const kindOverride = useAppStore((state) => state.agentKindOverride?.[agentId] ?? null);
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride?.[agentId] ?? agent?.modelOverride ?? null,
  );
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride?.[agentId] ?? agent?.providerOverride ?? null,
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const roleModels = useAppStore((state) => roleModelsForSession({ state, sessionId: session.id }));
  const metrics = useAgentMetrics({ sessionId: session.id });

  if (agent == null || !isWorkflowStepAgent({ agent })) {
    return null;
  }

  const attached = attachedRuns.find(({ run }) => run.id === agent.workflowRunId) ?? null;
  const step = attached?.workflow.steps.find((candidate) => candidate.id === agent.stepId) ?? null;
  if (attached == null || step == null) {
    return null;
  }

  const sortedSteps = [...attached.workflow.steps].sort(
    (first, second) => first.ordinal - second.ordinal,
  );
  const previousStep =
    [...sortedSteps].reverse().find((candidate) => candidate.ordinal < step.ordinal) ?? null;
  const telemetry = metrics.latestTelemetryByAgentId.get(agentId) ?? null;
  const contextUsage = metrics.providerUsageByAgentId.get(agentId) ?? EMPTY_ARRAY;
  const dominantUsage = contextUsage[0] ?? null;
  const kind = classifyAgent(agent, kindOverride);
  const planned = resolveStepRouting({
    step,
    kind,
    roleModels,
    agentModel: modelOverride,
    agentProvider: providerOverride,
  });
  const model = telemetry?.model ?? dominantUsage?.model ?? planned.model;
  const provider = telemetry?.provider ?? dominantUsage?.provider ?? planned.provider;
  const instructions = step.promptPrefix.trim();
  const expectedOutput = step.expectedOutput?.trim() ?? '';
  const outputSummary = agent.outputSummary?.trim() ?? '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InspectorHeader title={step.name} />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-4">
          <InspectorSection question="What it is">
            <div className="flex flex-wrap items-center gap-1.5">
              <AgentKindChip kind={kind} />
              <AgentStatusBadge status={agent.status} />
            </div>
            <RoutingBadge variant="full" provider={provider} model={model} effort={agent.effort} />
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-2xs">
              <dt className="text-muted-foreground/60">Started</dt>
              <dd className="text-foreground/80">
                {agent.startedAt == null
                  ? 'not started'
                  : formatAbsoluteDateTime({ iso: agent.startedAt })}
              </dd>
              <dt className="text-muted-foreground/60">Completed</dt>
              <dd className="text-foreground/80">
                {agent.completedAt == null
                  ? 'not completed'
                  : formatAbsoluteDateTime({ iso: agent.completedAt })}
              </dd>
            </dl>
          </InspectorSection>
          <Divider />
          <InspectorSection question="Instructions">
            {instructions === '' ? (
              <p className="text-xs italic text-muted-foreground/60">No instructions provided.</p>
            ) : (
              <Markdown text={instructions} className="text-xs text-foreground/90" />
            )}
          </InspectorSection>
          <Divider />
          <InspectorSection question="Expected output">
            {expectedOutput === '' ? (
              <p className="text-xs italic text-muted-foreground/60">
                No expected output provided.
              </p>
            ) : (
              <Markdown text={expectedOutput} className="text-xs text-foreground/90" />
            )}
          </InspectorSection>
          <Divider />
          <InspectorSection question="Where it came from">
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-2xs">
              <dt className="text-muted-foreground/60">Source</dt>
              <dd className="text-foreground/80">
                Step {step.ordinal + 1}: {step.name}
              </dd>
              {previousStep != null ? (
                <>
                  <dt className="text-muted-foreground/60">Previous</dt>
                  <dd className="text-foreground/80">{previousStep.name}</dd>
                </>
              ) : null}
            </dl>
          </InspectorSection>
          <Divider />
          <InspectorSection question="What it produced">
            {outputSummary === '' ? (
              <p className="text-xs italic text-muted-foreground/60">No output summary yet.</p>
            ) : (
              <Markdown
                text={stripControlMarkers(outputSummary)}
                className="text-xs text-foreground/90"
              />
            )}
          </InspectorSection>
          <Divider />
          <CostsSection
            aggregate={metrics.aggregatesByAgentId.get(agentId) ?? null}
            contextUsage={contextUsage}
            turns={metrics.turnsByAgentId.get(agentId) ?? 0}
          />
        </div>
      </ScrollFade>
    </div>
  );
};
