import { isAgentStatusSettled } from '@goodboy/core';
import {
  cn,
  Divider,
  formatUsdPrecise,
  Input,
  MetaRow,
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
import { OrchestratorPanel } from '../../../workflows/components/OrchestratorPanel';
import { RunSpendLimitPopover } from '../../../workflows/components/RunSpendLimitPopover';
import { WorkflowRunSummary } from '../../../workflows/components/WorkflowRunSummary';
import { WorkflowAddStep } from '../../../workflows/components/WorkflowAddStep';
import { CreateReportCta } from '../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../wireframes/components/CreateWireframeCta';
import { WorkflowAutorunToggle } from '../../../workflows/components/WorkflowAutorunToggle';
import { useWorkflowTitleRename } from '../../../workflows/hooks/useWorkflowTitleRename';
import { RunTree } from '../../../workflows/components/RunTree';
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
import { WorkflowKillButton } from './WorkflowKillButton';
import { WorkflowRunMenu } from './WorkflowRunMenu';
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
  const writableMountCount = useAppStore(
    (state) => selectWritableMounts({ state, sessionId: task.id }).length,
  );
  const isDiscarded = run.discardedAt != null;
  const wfAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
  const actionableStepId = actionableStepIdByRunId.get(run.id) ?? null;
  const wfBlockReason = blockReasonByRunId.get(run.id) ?? null;
  const name = workflowKindName(workflow);
  const rename = useWorkflowTitleRename({
    workspaceId: workflow.workspaceId,
    workflowId: workflow.id,
    currentTitle: workflow.name,
  });
  const total = workflow.steps.length;
  const done = wfAgents.filter((a) => isAgentStatusSettled({ status: a.status })).length;
  const isDynamic = run.executionMode === 'dynamic';
  const isCompleted =
    !isDiscarded && (isDynamic ? run.orchestrationOutcome === 'done' : total > 0 && done >= total);
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
    <div
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col motion-safe:animate-studio-in',
        isDiscarded && TERMINAL_DIM,
      )}
    >
      <div className={cn('shrink-0', PANE_RHYTHM.header)}>
        <div className={cn('flex flex-col gap-4', PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
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
                      <h2 className="truncate text-xl font-semibold leading-snug text-foreground">
                        {name}
                      </h2>
                      <Tooltip content="Edit workflow name">
                        <button
                          type="button"
                          onClick={rename.start}
                          aria-label="Edit workflow name"
                          className={cn(
                            'mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-faint-foreground',
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
                {rename.editing && workflow.isPreset !== false && (
                  <p className="text-2xs leading-relaxed text-faint-foreground">
                    This preset is shared: the new name shows on every run and every future attach.
                  </p>
                )}
                <MetaRow
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
              <CardActionSlot label="Workflow lifecycle actions" className="gap-2">
                {isQueuedManual ? (
                  <WorkflowRunStartButton
                    variant="detail"
                    blockReason={wfBlockReason}
                    onStart={() => startWorkflowRun(task.id, run.id)}
                  />
                ) : null}
                {!isDiscarded && !isCompleted && !hasOrchestratorStrip && (
                  <WorkflowAutorunToggle
                    variant="detail"
                    isOn={run.autoRun}
                    onToggle={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                  />
                )}
                <Divider orientation="vertical" className="h-5 self-center" />
                {isDiscarded ? (
                  <GhostActionButton
                    icon={Undo2}
                    label="Restore"
                    onClick={() => void restoreWorkflow(task.id, run.id)}
                  />
                ) : (
                  <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
                )}
                <WorkflowRunMenu
                  workflowName={name}
                  onDelete={() => void onDeleteWorkflow(run.id)}
                />
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
          <div className={cn('flex flex-col gap-2', PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
            {!isDiscarded && !isDynamic && (
              <div className="pb-1">
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
              </div>
            )}
            {!isDiscarded && isDynamic && (
              <div className="pb-1">
                <OrchestratorPanel
                  sessionId={task.id}
                  run={run}
                  agents={wfAgents}
                  steps={workflow.steps}
                  costUsd={costUsd}
                  isOrchestrating={isOrchestrating}
                />
              </div>
            )}
            {wfAgents.length > 0 ? (
              <RunTree
                session={task}
                run={run}
                workflow={workflow}
                agentKindOverride={agentKindOverride}
                routing={{
                  stepById,
                  roleModels,
                  sessionProvider,
                  sessionEffort,
                }}
                selectedAgentId={selectedAgentId}
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
            <WorkflowRunSummary summary={run.orchestratorSummary} />
            {expanded && (
              <div className="flex flex-col gap-2">
                <WorkflowRunAsk
                  goal={(run.goal ?? workflow.goal ?? '').trim()}
                  processText={(workflow.processText ?? '').trim()}
                />
                <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
              </div>
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
  );
};
