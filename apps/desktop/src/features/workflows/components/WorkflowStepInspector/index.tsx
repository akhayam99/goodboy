import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Divider, EmptyState, Markdown, ScrollFade, SectionHeader } from '@goodboy/ui';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { stripControlMarkers } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  SpawnedAgentList,
  type SpawnedAgentItem,
} from '../../../../shared/components/SpawnedAgentList';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { classifyAgent } from '../../../session/agent-kind';
import { useAgentMetrics } from '../../../session/hooks/useAgentMetrics';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { InspectorHeader } from '../../../session/components/SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { CostsSection } from '../../../session/components/AgentInspector/CostsSection';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { useAttachedWorkflowRuns } from '../../useAttachedWorkflowRuns';
import { isWorkflowStepAgent } from '../../isWorkflowStepAgent';
import { resolveStepRouting } from '../../resolveStepRouting';
import { roleModelsForSession } from '../../../../store/slices/overrides/roleModelsForSession';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

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
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const turnStates = useAppStore(useShallow((state) => state.agentTurnState));
  const selectAgent = useAppStore((state) => state.selectAgent);
  const spawnedChildren = useMemo(
    () => selectSpawnedChildren({ runs: phaseRuns, parentAgentId: agentId, turnStates }),
    [phaseRuns, agentId, turnStates],
  );
  const childItems = useMemo<ReadonlyArray<SpawnedAgentItem>>(
    () =>
      spawnedChildren.map((child) => ({
        key: child.agent.id,
        index: child.index,
        total: child.total,
        name: child.agent.name,
        body: null,
        status: child.status,
        agentId: child.agent.id,
      })),
    [spawnedChildren],
  );

  if (agent == null || !isWorkflowStepAgent({ agent })) {
    return null;
  }

  const onSelectChild = (childAgentId: AgentId) => {
    void selectAgent(session.id, childAgentId);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

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
          <section className="flex flex-col gap-2">
            <SectionHeader label="Identity" />
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
          </section>
          {childItems.length > 0 ? (
            <>
              <Divider />
              <section className="flex flex-col gap-2">
                <SectionHeader label="Spawned" />
                <SpawnedAgentList
                  items={childItems}
                  selectedAgentId={undefined}
                  onSelect={onSelectChild}
                  variant="inline"
                />
              </section>
            </>
          ) : null}
          <Divider />
          <section className="flex flex-col gap-2">
            <SectionHeader label="Instructions" />
            {instructions === '' ? (
              <EmptyState
                icon={CONCEPT_ICONS.workflows}
                tone={CONCEPT_TONE.workflows}
                title="No instructions provided"
                size="inline"
              />
            ) : (
              <Markdown text={instructions} className="text-xs text-foreground/90" />
            )}
          </section>
          <Divider />
          <section className="flex flex-col gap-2">
            <SectionHeader label="Expected output" />
            {expectedOutput === '' ? (
              <EmptyState
                icon={CONCEPT_ICONS.workflows}
                tone={CONCEPT_TONE.workflows}
                title="No expected output provided"
                size="inline"
              />
            ) : (
              <Markdown text={expectedOutput} className="text-xs text-foreground/90" />
            )}
          </section>
          <Divider />
          <section className="flex flex-col gap-2">
            <SectionHeader label="Origin" />
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
          </section>
          <Divider />
          <section className="flex flex-col gap-2">
            <SectionHeader label="Summary" />
            {outputSummary === '' ? (
              <EmptyState
                icon={CONCEPT_ICONS.sessionSummary}
                tone={CONCEPT_TONE.sessionSummary}
                title="No output summary yet"
                size="inline"
              />
            ) : (
              <Markdown
                text={stripControlMarkers(outputSummary)}
                className="text-xs text-foreground/90"
              />
            )}
          </section>
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
