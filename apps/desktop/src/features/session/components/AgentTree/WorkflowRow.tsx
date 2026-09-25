import { useState } from 'react';
import { isAgentStatusSettled, runsForWorkflowRun } from '@goodboy/core';
import {
  cn,
  formatUsdPrecise,
  Input,
  PANE_RHYTHM,
  ScrollFade,
  TERMINAL_DIM,
  Tooltip,
  tintClasses,
} from '@goodboy/ui';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import type {
  Agent,
  AgentId,
  EffortLevel,
  OpenQuestion,
  ProviderId,
  Session,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useRunSpendUsd } from '../../../../store';
import type { AppStore } from '../../../../store/store';
import { selectWritableMounts } from '../../../../store/slices/project-mounts/selectors';
import type { AgentKind } from '../../agent-kind';
import { agentRoutingOverrides } from '../../../workflows/agentRoutingOverrides';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import type { AgentAggregate } from '../AgentMetrics';
import { WorkflowNextStepCta } from '../../../workflows/components/WorkflowNextStepCta';
import { NextActionStrip } from '../../../workflows/components/NextActionStrip';
import { OrchestratorStrip } from '../../../workflows/components/OrchestratorStrip';
import { RunSpendLimitPopover } from '../../../workflows/components/RunSpendLimitPopover';
import { WorkflowRunSummary } from '../../../workflows/components/WorkflowRunSummary';
import { WorkflowAddStep } from '../../../workflows/components/WorkflowAddStep';
import { CreateReportCta } from '../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../wireframes/components/CreateWireframeCta';
import { WorkflowAutorunToggle } from '../../../workflows/components/WorkflowAutorunToggle';
import { useWorkflowRunTitleRename } from '../../../workflows/hooks/useWorkflowRunTitleRename';
import { RunTree } from '../../../workflows/components/RunTree';
import { WorkTimeProvider } from '../../../workTreeModel/components/WorkTimeProvider';
import { useRunTree } from '../../../workflows/components/RunTree/useRunTree';
import { WorkflowDecisions } from '../../../workflows/components/WorkflowDecisions';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { WriteDestinationControl } from '../../../chat/components/WriteDestinationControl';
import { CostBadge } from '../../../providers/components/CostBadge';
import { CardAction } from '@goodboy/ui';
import { CardActionSlot } from '@goodboy/ui';
import { GhostActionButton } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import type { StartStepAgentParams } from './useAgentsSection';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRunAsk } from './WorkflowRunAsk';
import { WorkflowRunStartButton } from './WorkflowRunStartButton';
import { WorkflowCloseButton } from '../../../workflows/components/WorkflowCloseButton';
import { WorkflowRunMenu } from '../../../workflows/components/WorkflowRunMenu';
import { isWorkflowRunClosable } from '../../../workflows/isWorkflowRunClosable';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';
import { WorkflowRunMeta } from './WorkflowRunMeta';
import { WorkflowRunStatus } from './WorkflowRunStatus';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly task: Session;
  readonly agentsByRunId: ReadonlyMap<string, Agent[]>;
  readonly actionableStepIdByRunId: ReadonlyMap<string, string | null>;
  readonly blockReasonByRunId: ReadonlyMap<string, WorkflowBlockReason | null>;
  readonly focusedWorkflowRunId: string | null;
  readonly workflowExpand: Readonly<Record<string, boolean>> | undefined;
  readonly workflowNameByRunId: ReadonlyMap<string, string>;
  readonly toggleWorkflowExpand: AppStore['toggleWorkflowExpand'];
  readonly startWorkflowRun: AppStore['startWorkflowRun'];
  readonly setWorkflowRunAutoRun: AppStore['setWorkflowRunAutoRun'];
  readonly onDiscardWorkflow: (runId: WorkflowRunId) => Promise<void>;
  readonly onDeleteWorkflow: (runId: WorkflowRunId) => Promise<void>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly agentProviderOverride: Readonly<Record<string, ProviderId>>;
  readonly agentEffortOverride: Readonly<Record<string, EffortLevel>>;
  readonly childrenByParentId: ReadonlyMap<string, Agent[]>;
  readonly selectedAgentId: AgentId | null;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly onStartStepAgent: (params: StartStepAgentParams) => Promise<void>;
  readonly onPickAgent: (id: AgentId) => void;
  readonly onAnswerQuestion: (question: OpenQuestion | null) => void;
};

type TreeCountParams = {
  readonly agent: Agent;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
};

const countAgentTree = ({ agent, childrenByParentId }: TreeCountParams): number =>
  (childrenByParentId.get(agent.id) ?? []).reduce(
    (sum, child) => sum + countAgentTree({ agent: child, childrenByParentId }),
    1,
  );

export const WorkflowRow = ({
  run,
  workflow,
  task,
  agentsByRunId,
  actionableStepIdByRunId,
  blockReasonByRunId,
  focusedWorkflowRunId,
  workflowExpand,
  workflowNameByRunId,
  toggleWorkflowExpand,
  startWorkflowRun,
  setWorkflowRunAutoRun,
  onDiscardWorkflow,
  onDeleteWorkflow,
  agentKindOverride,
  agentModelOverride,
  agentProviderOverride,
  agentEffortOverride,
  childrenByParentId,
  selectedAgentId,
  aggregatesByAgentId,
  onStartStepAgent,
  onPickAgent,
  onAnswerQuestion,
}: Props) => {
  const roleModels = useSessionRoleModels({ sessionId: task.id });
  const sessionProvider = task.providerPreference?.defaultProvider ?? null;
  const sessionEffort = task.effort ?? null;
  const isOrchestrating = useAppStore((s) => s.orchestratingWorkflowRuns?.[run.id] ?? false);
  const restoreWorkflow = useAppStore((s) => s.restoreWorkflow);
  const closeWorkflowRun = useAppStore((s) => s.closeWorkflowRun);
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[task.id] ?? EMPTY_ARRAY);
  const writableMountCount = useAppStore(
    (state) => selectWritableMounts({ state, sessionId: task.id }).length,
  );
  const isDiscarded = run.discardedAt != null;
  const wfAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
  const actionableStepId = actionableStepIdByRunId.get(run.id) ?? null;
  const wfBlockReason = blockReasonByRunId.get(run.id) ?? null;
  const name = run.title ?? workflowKindName(workflow);
  const rename = useWorkflowRunTitleRename({
    sessionId: task.id,
    workflowRunId: run.id,
    currentTitle: run.title ?? workflow.name,
  });
  const total = workflow.steps.length;
  const done = wfAgents.filter((a) => isAgentStatusSettled({ status: a.status })).length;
  const isDynamic = run.executionMode === 'dynamic';
  const isClosed = isWorkflowRunClosedByUser({ run });
  const isCompleted =
    !isDiscarded &&
    (isClosed || (isDynamic ? run.orchestrationOutcome === 'done' : total > 0 && done >= total));
  const isClosable = isWorkflowRunClosable({
    run,
    workflow,
    agents: runsForWorkflowRun(sessionAgents, run.id),
  });
  const agentCount = wfAgents.reduce(
    (sum, agent) => sum + countAgentTree({ agent, childrenByParentId }),
    0,
  );
  const expanded =
    focusedWorkflowRunId != null
      ? run.id === focusedWorkflowRunId
      : (workflowExpand?.[run.id] ?? true);
  const hasStarted = wfAgents.length > 0;
  const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && !hasStarted;
  const predecessorName = run.chainAfterId
    ? (workflowNameByRunId.get(run.chainAfterId) ?? 'previous')
    : 'previous';
  const runCostUsd = wfAgents.reduce(
    (total, agent) => total + (aggregatesByAgentId.get(agent.id)?.estimatedCostUsd ?? 0),
    0,
  );
  const runSpendUsd = useRunSpendUsd(task.id, run.id);
  const costUsd = isDynamic ? runSpendUsd : runCostUsd;
  const stepById = new Map(workflow.steps.map((step) => [step.id, step]));
  const tree = useRunTree({ session: task, run, workflow, agentKindOverride });
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const selectedStepId =
    wfAgents.find((agent) => agent.id === selectedAgentId && agent.parentAgentId == null)?.stepId ??
    null;
  const highlightedStepId = hoveredStepId ?? selectedStepId;
  const hasOrchestratorStrip = isDynamic && !isDiscarded && expanded;
  const ctaAgent =
    wfAgents.find((agent) => agent.stepId === actionableStepId && agent.status === 'pending') ??
    null;
  const ctaRouting = agentRoutingOverrides({
    agent: ctaAgent,
    modelOverride: ctaAgent != null ? (agentModelOverride[ctaAgent.id] ?? null) : null,
    providerOverride: ctaAgent != null ? (agentProviderOverride[ctaAgent.id] ?? null) : null,
    effortOverride: ctaAgent != null ? (agentEffortOverride[ctaAgent.id] ?? null) : null,
  });
  return (
    <WorkTimeProvider sessionId={task.id} workspaceId={task.workspaceId}>
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col motion-safe:animate-studio-in',
          isDiscarded && TERMINAL_DIM,
        )}
      >
        <div className={cn('shrink-0', PANE_RHYTHM.header)}>
          <div className={cn('flex flex-col gap-4', PANE_RHYTHM.column)}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto] items-start gap-2">
              <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    tintClasses('primary').bg,
                  )}
                >
                  <CONCEPT_ICONS.workflows
                    size={ICON_SIZE.hero}
                    aria-hidden
                    className="text-primary"
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {rename.editing ? (
                      <Input
                        autoFocus
                        value={rename.draft}
                        maxLength={rename.maxLength}
                        onChange={(event) => rename.setDraft(event.target.value)}
                        onBlur={() => void rename.commit()}
                        onKeyDown={rename.onKeyDown}
                        aria-label="Workflow name"
                        className="text-xl font-semibold"
                      />
                    ) : (
                      <div className="group/name flex min-w-0 items-start gap-1.5">
                        <h2
                          title={name}
                          className="line-clamp-2 min-w-0 break-words text-xl font-semibold leading-snug text-foreground"
                        >
                          {name}
                        </h2>
                        <Tooltip content="Edit workflow name">
                          <button
                            type="button"
                            onClick={rename.start}
                            aria-label="Edit workflow name"
                            className={cn(
                              'mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-faint-foreground',
                              'opacity-0 transition-[opacity,color,background-color] hover:bg-hover hover:text-foreground',
                              'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                              'group-hover/name:opacity-100 motion-reduce:opacity-60',
                            )}
                          >
                            <CONCEPT_ICONS.rename size={ICON_SIZE.row} aria-hidden />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                    <WorkflowRunStatus
                      run={run}
                      workflow={workflow}
                      agents={wfAgents}
                      predecessorName={predecessorName}
                      isOrchestrating={isOrchestrating}
                      hasOrchestratorStrip={hasOrchestratorStrip}
                      blockReason={wfBlockReason}
                    />
                  </div>
                  <WorkflowRunMeta
                    items={[
                      total > 0 ? (
                        <span className="tabular-nums">
                          {isDynamic
                            ? `${total} ${total === 1 ? 'step' : 'steps'}`
                            : `Step ${Math.min(done + 1, total)} of ${total}`}
                        </span>
                      ) : null,
                      total > 0 && agentCount !== total ? (
                        <span className="tabular-nums">
                          {`${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`}
                        </span>
                      ) : null,
                      <CostBadge
                        value={costUsd}
                        title={`${formatUsdPrecise(costUsd)} for this run`}
                      />,
                      isDynamic && !isDiscarded ? (
                        <RunSpendLimitPopover sessionId={task.id} run={run} variant="meta" />
                      ) : null,
                    ]}
                    run={run}
                    steps={workflow.steps}
                    agents={wfAgents}
                    roleModels={roleModels}
                    sessionProvider={sessionProvider}
                    sessionEffort={sessionEffort}
                    isTimeLeftShown={!isDiscarded && !isCompleted && run.orchestrationStop == null}
                  />
                </div>
              </div>
              <div className="col-start-2 row-start-1 flex items-start gap-2 self-start">
                <CardActionSlot label="Workflow navigation actions">
                  <CardAction
                    icon={expanded ? ChevronDown : ChevronRight}
                    label={`${expanded ? 'Collapse' : 'Expand'} ${name} workflow`}
                    expanded={expanded}
                    onClick={() => toggleWorkflowExpand(task.id, run.id, expanded)}
                  />
                </CardActionSlot>
                <CardActionSlot label="Workflow lifecycle actions" className="gap-4">
                  <div className="flex items-center gap-2">
                    {isQueuedManual ? (
                      <WorkflowRunStartButton
                        variant="detail"
                        blockReason={wfBlockReason}
                        onStart={() => startWorkflowRun(task.id, run.id)}
                      />
                    ) : null}
                    {!isDiscarded && !isCompleted && !hasOrchestratorStrip && (
                      <WorkflowAutorunToggle
                        isOn={run.autoRun}
                        onToggle={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isClosable ? (
                      <WorkflowCloseButton
                        onConfirm={() => void closeWorkflowRun(task.id, run.id)}
                      />
                    ) : null}
                    {isDiscarded ? (
                      <GhostActionButton
                        icon={Undo2}
                        label="Restore"
                        onClick={() => void restoreWorkflow(task.id, run.id)}
                      />
                    ) : null}
                    <WorkflowRunMenu
                      workflowName={name}
                      onDiscard={isDiscarded ? null : () => void onDiscardWorkflow(run.id)}
                      onDelete={() => void onDeleteWorkflow(run.id)}
                    />
                  </div>
                </CardActionSlot>
              </div>
            </div>
            {expanded && !isDiscarded && writableMountCount > 1 && (
              <WriteDestinationControl sessionId={task.id} agentId={null} fallback="automatic" />
            )}
            {expanded && !isDiscarded && (
              <NextActionStrip
                sessionId={task.id}
                run={run}
                workflow={workflow}
                subjectAgentId={null}
              />
            )}
          </div>
        </div>
        {expanded && (
          <ScrollFade
            className="min-h-0 min-w-0 flex-1"
            viewportClassName={cn(PANE_RHYTHM.inset, 'pb-5')}
            fadeSize={24}
          >
            <div className={cn(PANE_RHYTHM.stack, PANE_RHYTHM.column)}>
              {!isDiscarded && !isDynamic && (
                <WorkflowNextStepCta
                  workflow={workflow}
                  runs={wfAgents}
                  roleModels={roleModels}
                  agentModel={ctaRouting.agentModel}
                  agentProvider={ctaRouting.agentProvider}
                  agentEffort={ctaRouting.agentEffort}
                  sessionProvider={sessionProvider}
                  sessionEffort={sessionEffort}
                  blockReason={wfBlockReason}
                  onAdvance={({ step, isConfirmed }) => {
                    const pending = wfAgents.find(
                      (agent) => agent.stepId === step.id && agent.status === 'pending',
                    );
                    if (pending == null) {
                      return;
                    }
                    void onStartStepAgent({ agent: pending, isConfirmed });
                  }}
                />
              )}
              {!isDiscarded && isDynamic && (
                <OrchestratorStrip
                  sessionId={task.id}
                  run={run}
                  agents={wfAgents}
                  steps={workflow.steps}
                  costUsd={costUsd}
                  isOrchestrating={isOrchestrating}
                />
              )}
              <div className="flex min-w-0 flex-col gap-2">
                {wfAgents.length > 0 ? (
                  <RunTree
                    sessionId={task.id}
                    runId={run.id}
                    tree={tree}
                    routing={{
                      stepById,
                      roleModels,
                      sessionProvider,
                      sessionEffort,
                    }}
                    selectedAgentId={selectedAgentId}
                    highlightedStepId={highlightedStepId}
                    onHighlight={setHoveredStepId}
                    onSelect={onPickAgent}
                    onAnswer={onAnswerQuestion}
                  />
                ) : (
                  <p className="pb-1 text-2xs text-faint-foreground">
                    No agents yet for this workflow.
                  </p>
                )}
                {!isDiscarded && !isCompleted && (
                  <WorkflowAddStep
                    sessionId={task.id}
                    workspaceId={workflow.workspaceId}
                    workflowRunId={run.id}
                    stepCount={total}
                  />
                )}
              </div>
              <WorkflowRunSummary summary={run.orchestratorSummary} />
              <div className="flex min-w-0 flex-col gap-2">
                <WorkflowRunAsk
                  goal={(run.goal ?? workflow.goal ?? '').trim()}
                  processText={(workflow.processText ?? '').trim()}
                />
                <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
              </div>
              {isDynamic && (
                <WorkflowDecisions
                  run={run}
                  steps={workflow.steps}
                  tree={tree}
                  highlightedStepId={highlightedStepId}
                  onHighlight={setHoveredStepId}
                />
              )}
              {isCompleted && (
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <CreateReportCta sessionId={task.id} workflowRunId={run.id} />
                  <CreateWireframeCta sessionId={task.id} workflowRunId={run.id} />
                  <WorkflowAddStep
                    sessionId={task.id}
                    workspaceId={workflow.workspaceId}
                    workflowRunId={run.id}
                    stepCount={total}
                  />
                </div>
              )}
            </div>
          </ScrollFade>
        )}
      </div>
    </WorkTimeProvider>
  );
};
