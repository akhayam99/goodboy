import { Fragment, type Dispatch, type SetStateAction } from 'react';
import { cn, formatUsd, formatUsdPrecise, MetaRow, StatusDot } from '@goodboy/ui';
import { ChevronDown, ChevronRight, ChevronUp, Play, Undo2, Zap, ZapOff } from 'lucide-react';
import type {
  Agent,
  AgentId,
  ProviderId,
  Session,
  TelemetryRecord,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import { inferAgentKindFromName, type AgentKind } from '../../../../../features/session/agent-kind';
import { resolveStepRouting } from '../../../../../features/workflows/resolveStepRouting';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetrics';
import { WorkflowNextStepCta } from '../../../../../features/workflows/components/WorkflowNextStepCta';
import { OrchestratorPanel } from '../../../../../features/workflows/components/OrchestratorPanel';
import { WorkflowStepGraph } from '../../../../../features/workflows/components/WorkflowStepGraph';
import { GoalAttachmentsStrip } from '../../../../../features/context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { CardAction } from '../../../../../shared/components/CardAction';
import { CardActionSlot } from '../../../../../shared/components/CardActionSlot';
import { GhostActionButton } from '../../../../../shared/components/GhostActionButton';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';
import { workflowKindName } from '../lib';
import type { ProviderContextUsage } from './ContextWindowBar';
import { WorkflowRunAsk } from './WorkflowRunAsk';
import { WorkflowStepRow } from './WorkflowStepRow';
import { ScoutSubtree } from './ScoutSubtree';
import { ClusterChildRow } from './ClusterChildRow';
import { WorkflowKillButton } from './WorkflowKillButton';
import { WorkflowDeleteButton } from './WorkflowDeleteButton';
import { WorkflowRunStatus } from './WorkflowRunStatus';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly index: number;
  readonly task: Session;
  readonly attachedRuns: ReadonlyArray<{ run: WorkflowRun; workflow: Workflow }>;
  readonly agentsByRunId: ReadonlyMap<string, Agent[]>;
  readonly actionableStepIdByRunId: ReadonlyMap<string, string | null>;
  readonly blockReasonByRunId: ReadonlyMap<string, WorkflowBlockReason | null>;
  readonly countUnread: (agents: ReadonlyArray<Agent>) => number;
  readonly focusedWorkflowRunId: string | null;
  readonly workflowExpand: Readonly<Record<string, boolean>> | undefined;
  readonly workflowNameByRunId: ReadonlyMap<string, string>;
  readonly forceExpanded: boolean;
  readonly variant?: 'sidebar' | 'detail';
  readonly toggleWorkflowExpand: AppStore['toggleWorkflowExpand'];
  readonly startWorkflowRun: AppStore['startWorkflowRun'];
  readonly setWorkflowRunAutoRun: AppStore['setWorkflowRunAutoRun'];
  readonly onReorderWorkflow: (runId: WorkflowRunId, direction: 'up' | 'down') => Promise<void>;
  readonly onDiscardWorkflow: (runId: WorkflowRunId) => Promise<void>;
  readonly onDeleteWorkflow: (runId: WorkflowRunId) => Promise<void>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly agentProviderOverride: Readonly<Record<string, ProviderId>>;
  readonly childrenByParentId: ReadonlyMap<string, Agent[]>;
  readonly clusterExpand: ReadonlyMap<string, boolean>;
  readonly selectedAgentId: AgentId | null;
  readonly isTaskActive: boolean;
  readonly editingId: AgentId | null;
  readonly latestTelemetryByAgentId: ReadonlyMap<string, TelemetryRecord>;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly providerUsageByAgentId: ReadonlyMap<string, ReadonlyArray<ProviderContextUsage>>;
  readonly turnsByAgentId: ReadonlyMap<string, number>;
  readonly isTranscriptLoading: boolean;
  readonly onStartStepAgent: (agent: Agent, model?: string) => Promise<void>;
  readonly onPickAgent: (id: AgentId) => void;
  readonly setEditingId: Dispatch<SetStateAction<AgentId | null>>;
  readonly onRenameCommit: (id: AgentId, name: string) => Promise<void>;
  readonly onResolveFirstForRun: (run: WorkflowRun) => void;
  readonly toggleClusterExpand: (id: string) => void;
  readonly skipStuckStepAndAdvance: AppStore['skipStuckStepAndAdvance'];
};

export const WorkflowRow = ({
  run,
  workflow,
  index,
  task,
  attachedRuns,
  agentsByRunId,
  actionableStepIdByRunId,
  blockReasonByRunId,
  countUnread,
  focusedWorkflowRunId,
  workflowExpand,
  workflowNameByRunId,
  forceExpanded,
  variant = 'sidebar',
  toggleWorkflowExpand,
  startWorkflowRun,
  setWorkflowRunAutoRun,
  onReorderWorkflow,
  onDiscardWorkflow,
  onDeleteWorkflow,
  agentKindOverride,
  agentModelOverride,
  agentProviderOverride,
  childrenByParentId,
  clusterExpand,
  selectedAgentId,
  isTaskActive,
  editingId,
  latestTelemetryByAgentId,
  aggregatesByAgentId,
  providerUsageByAgentId,
  turnsByAgentId,
  isTranscriptLoading,
  onStartStepAgent,
  onPickAgent,
  setEditingId,
  onRenameCommit,
  onResolveFirstForRun,
  toggleClusterExpand,
  skipStuckStepAndAdvance,
}: Props) => {
  const roleModels = useSessionRoleModels({ sessionId: task.id });
  const isOrchestrating = useAppStore((s) => s.orchestratingWorkflowRuns?.[run.id] ?? false);
  const restoreWorkflow = useAppStore((s) => s.restoreWorkflow);
  const workflowRun = run;
  const isDiscarded = run.discardedAt != null;
  const wfAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
  const actionableStepId = actionableStepIdByRunId.get(run.id) ?? null;
  const wfBlockReason = blockReasonByRunId.get(run.id) ?? null;
  const canMoveUp = index > 0;
  const canMoveDown = index < attachedRuns.length - 1;
  const name = workflowKindName(workflow);
  const total = workflow.steps.length;
  const done = wfAgents.filter((a) => a.status === 'completed' || a.status === 'skipped').length;
  const isDynamic = run.executionMode === 'dynamic';
  const isCompleted =
    !isDiscarded && (isDynamic ? run.orchestrationOutcome === 'done' : total > 0 && done >= total);
  const unreadCount = countUnread(wfAgents);
  const isDetail = variant === 'detail';
  const defaultExpanded = isDetail || (!isDiscarded && (!isCompleted || unreadCount > 0));
  const expanded =
    focusedWorkflowRunId != null
      ? run.id === focusedWorkflowRunId
      : (workflowExpand?.[run.id] ?? defaultExpanded);
  const hasStarted = wfAgents.length > 0;
  const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && !hasStarted;
  const predecessorName = run.chainAfterId
    ? (workflowNameByRunId.get(run.chainAfterId) ?? 'previous')
    : 'previous';
  const runCostUsd = wfAgents.reduce(
    (total, agent) => total + (aggregatesByAgentId.get(agent.id)?.estimatedCostUsd ?? 0),
    0,
  );
  const stepById = new Map(workflow.steps.map((step) => [step.id, step]));
  const hasOrchestratorStrip = isDynamic && !isDiscarded && expanded;
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto]',
        isDetail && expanded && 'grid-rows-[auto_1fr_auto] gap-y-4',
        isDetail && !expanded && 'grid-rows-[auto_auto] gap-y-4',
        !isDetail && expanded && 'grid-rows-[auto_auto] gap-y-1.5',
        !isDetail && !expanded && 'grid-rows-[auto]',
        isDiscarded && 'opacity-70',
      )}
    >
      <div className="col-span-2 row-start-1 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto] items-start gap-2">
        {isDetail ? (
          <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <CONCEPT_ICONS.workflows size={17} aria-hidden className="text-accent" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold leading-snug text-foreground">
                  {name}
                </h2>
                <WorkflowRunStatus
                  run={run}
                  workflow={workflow}
                  agents={wfAgents}
                  predecessorName={predecessorName}
                  hasOrchestratorStrip={hasOrchestratorStrip}
                />
              </div>
              <MetaRow
                items={[
                  total > 0 ? (
                    <span className="tabular-nums">
                      Step {Math.min(done + 1, total)} of {total}
                    </span>
                  ) : null,
                  <CostBadge
                    value={runCostUsd}
                    title={`${formatUsdPrecise(runCostUsd)} for this run`}
                  />,
                ]}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleWorkflowExpand(task.id, run.id, expanded)}
            title={workflow.name || name}
            aria-expanded={expanded}
            aria-label={`${name} workflow`}
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-muted/50"
          >
            {forceExpanded ? (
              <CONCEPT_ICONS.workflows size={13} aria-hidden className="shrink-0 text-accent" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {name}
            </span>
            {unreadCount > 0 ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-2xs font-medium text-warning"
                title={`${unreadCount} agent ${unreadCount === 1 ? 'reply' : 'replies'} to review`}
              >
                <StatusDot tone="warning" size="sm" />
                {unreadCount}
              </span>
            ) : null}
            <WorkflowRunStatus
              run={run}
              workflow={workflow}
              agents={wfAgents}
              predecessorName={predecessorName}
              hasOrchestratorStrip={hasOrchestratorStrip}
            />
            {total > 0 ? (
              <span className="shrink-0 font-mono text-2xs text-muted-foreground/50">
                {done}/{total}
              </span>
            ) : null}
          </button>
        )}
        {isDetail ? (
          <CardActionSlot
            label="Workflow navigation actions"
            className="col-start-2 row-start-1 self-start"
          >
            <CardAction
              icon={expanded ? ChevronDown : ChevronRight}
              label={`${expanded ? 'Collapse' : 'Expand'} ${name} workflow`}
              expanded={expanded}
              onClick={() => toggleWorkflowExpand(task.id, run.id, expanded)}
            />
          </CardActionSlot>
        ) : (
          <div className="col-start-2 row-start-1 flex items-start gap-1">
            {!isDiscarded ? (
              <CardActionSlot label="Workflow lifecycle actions">
                {isQueuedManual ? (
                  <CardAction
                    icon={Play}
                    label="Start workflow now"
                    tone="success"
                    onClick={() => void startWorkflowRun(task.id, run.id)}
                  />
                ) : null}
                {!isCompleted ? (
                  <CardAction
                    icon={run.autoRun ? Zap : ZapOff}
                    label={run.autoRun ? 'Autorun on' : 'Autorun off'}
                    tone="primary"
                    pressed={run.autoRun}
                    highlighted={run.autoRun}
                    onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                  />
                ) : null}
                <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
              </CardActionSlot>
            ) : null}
            <CardActionSlot label="Workflow navigation actions">
              <CardAction
                icon={expanded ? ChevronDown : ChevronRight}
                label={`${expanded ? 'Collapse' : 'Expand'} ${name} workflow`}
                expanded={expanded}
                onClick={() => toggleWorkflowExpand(task.id, run.id, expanded)}
              />
              {!isDiscarded && !isCompleted && attachedRuns.length > 1 ? (
                <>
                  <CardAction
                    icon={ChevronUp}
                    label="Move workflow up"
                    disabled={!canMoveUp}
                    onClick={() => void onReorderWorkflow(run.id, 'up')}
                  />
                  <CardAction
                    icon={ChevronDown}
                    label="Move workflow down"
                    disabled={!canMoveDown}
                    onClick={() => void onReorderWorkflow(run.id, 'down')}
                  />
                </>
              ) : null}
            </CardActionSlot>
          </div>
        )}
      </div>
      {expanded ? (
        <div className="col-span-2 row-start-2 flex flex-col gap-2">
          {isDetail && expanded ? (
            <div className="flex flex-col gap-2">
              <WorkflowRunAsk
                goal={(run.goal ?? workflow.goal ?? '').trim()}
                processText={(workflow.processText ?? '').trim()}
              />
              <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
            </div>
          ) : null}
          {expanded && !isDiscarded ? (
            <div
              className={cn(
                'flex flex-col gap-2 pb-1',
                !isDetail && (forceExpanded ? 'pl-1' : 'pl-3'),
              )}
            >
              {isDynamic ? (
                <OrchestratorPanel
                  sessionId={task.id}
                  run={run}
                  agents={wfAgents}
                  steps={workflow.steps}
                  costUsd={runCostUsd}
                  isOrchestrating={isOrchestrating}
                />
              ) : null}
            </div>
          ) : null}
          {expanded ? (
            wfAgents.length > 0 ? (
              isDetail ? (
                <WorkflowStepGraph
                  workflow={workflow}
                  runs={wfAgents}
                  childrenByParentId={childrenByParentId}
                  agentKindOverride={agentKindOverride}
                  agentModelOverride={agentModelOverride}
                  agentProviderOverride={agentProviderOverride}
                  roleModels={roleModels}
                  selectedAgentId={selectedAgentId}
                  onSelect={onPickAgent}
                />
              ) : (
                <div className={cn('flex flex-col gap-1 pb-1', forceExpanded ? 'pl-1' : 'pl-3')}>
                  {wfAgents.map((run, index) => {
                    const isActionable =
                      run.stepId === actionableStepId && run.status === 'pending';
                    const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
                    const step = run.stepId != null ? stepById.get(run.stepId) : undefined;
                    const resolvedRouting = resolveStepRouting({
                      step: step ?? null,
                      kind,
                      roleModels,
                      agentModel: agentModelOverride[run.id] ?? run.modelOverride,
                      agentProvider: agentProviderOverride[run.id] ?? run.providerOverride,
                    });
                    const clusterChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
                    const clustersExpanded = clusterExpand.get(run.id) ?? false;
                    const clusterUnread = countUnread(clusterChildren);
                    return (
                      <Fragment key={run.id}>
                        <WorkflowStepRow
                          run={run}
                          kind={kind}
                          index={index}
                          resolvedModel={resolvedRouting.model}
                          resolvedProvider={resolvedRouting.provider}
                          isActionable={isActionable}
                          blockReason={isActionable ? wfBlockReason : null}
                          isSelected={run.id === selectedAgentId}
                          isTaskActive={isTaskActive}
                          isEditing={editingId === run.id}
                          telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
                          aggregate={aggregatesByAgentId.get(run.id) ?? null}
                          contextUsage={providerUsageByAgentId.get(run.id) ?? EMPTY_ARRAY}
                          turns={turnsByAgentId.get(run.id) ?? 0}
                          turnsLoading={run.id === selectedAgentId && isTranscriptLoading}
                          onStart={() => void onStartStepAgent(run)}
                          onSelect={() => onPickAgent(run.id)}
                          onRenameStart={() => setEditingId(run.id)}
                          onRenameCommit={(name) => void onRenameCommit(run.id, name)}
                          onRenameCancel={() => setEditingId(null)}
                          onResolveFirst={() => onResolveFirstForRun(workflowRun)}
                        />
                        {clusterChildren.length === 0 ? null : kind === 'scout' ? (
                          <ScoutSubtree
                            containerId={run.id}
                            depth={0}
                            childrenByParentId={childrenByParentId}
                            aggregatesByAgentId={aggregatesByAgentId}
                            selectedAgentId={selectedAgentId}
                            isTaskActive={isTaskActive}
                            expandState={clusterExpand}
                            onToggle={toggleClusterExpand}
                            onSelect={onPickAgent}
                          />
                        ) : (
                          <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
                            <button
                              type="button"
                              onClick={() => toggleClusterExpand(run.id)}
                              aria-expanded={clustersExpanded}
                              aria-label={`${clustersExpanded ? 'Collapse' : 'Expand'} clusters for ${run.name}`}
                              className="flex items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                            >
                              {clustersExpanded ? (
                                <ChevronDown size={10} aria-hidden className="shrink-0" />
                              ) : (
                                <ChevronRight size={10} aria-hidden className="shrink-0" />
                              )}
                              <span className="min-w-0 truncate">
                                clusters{' '}
                                {clusterChildren.filter((c) => c.status === 'completed').length}/
                                {clusterChildren.length}
                              </span>
                              {!clustersExpanded && clusterUnread > 0 ? (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/15 px-1 py-0.5 text-2xs font-medium text-warning"
                                  title={`${clusterUnread} cluster ${clusterUnread === 1 ? 'reply' : 'replies'} to review`}
                                >
                                  <span aria-hidden className="size-1 rounded-full bg-warning" />
                                  {clusterUnread}
                                </span>
                              ) : null}
                            </button>
                            {clustersExpanded
                              ? clusterChildren.map((child, ci) => (
                                  <ClusterChildRow
                                    key={child.id}
                                    child={child}
                                    index={ci}
                                    total={clusterChildren.length}
                                    costUsd={
                                      aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0
                                    }
                                    isSelected={child.id === selectedAgentId}
                                    isTaskActive={isTaskActive}
                                    onSelect={() => onPickAgent(child.id)}
                                  />
                                ))
                              : null}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )
            ) : (
              <p className={cn('pb-1 text-2xs text-muted-foreground/60', !isDetail && 'pl-3')}>
                No agents yet for this workflow.
              </p>
            )
          ) : null}
          {expanded &&
          !isDiscarded &&
          !isDynamic &&
          (isDetail || wfBlockReason === 'failed-step') ? (
            <div className={cn('pb-1', !isDetail && (forceExpanded ? 'pl-1' : 'pl-3'))}>
              <WorkflowNextStepCta
                workflow={workflow}
                runs={wfAgents}
                roleModels={roleModels}
                blockReason={wfBlockReason}
                onAdvance={(step) => {
                  const pending = wfAgents.find(
                    (agent) => agent.stepId === step.id && agent.status === 'pending',
                  );
                  if (pending == null) {
                    return;
                  }
                  void onStartStepAgent(pending);
                }}
                onForceAdvance={() =>
                  void skipStuckStepAndAdvance(task.id, run.id, { onlyWhenBlocked: true })
                }
              />
            </div>
          ) : null}
          {expanded && !isDetail ? (
            <div className={cn('pb-1', !isDetail && 'pl-3')}>
              <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
            </div>
          ) : null}
        </div>
      ) : null}
      {isDetail ? (
        <CardActionSlot
          label="Workflow lifecycle actions"
          className={cn('col-start-2 self-end', expanded ? 'row-start-3' : 'row-start-2')}
        >
          {isQueuedManual ? (
            <GhostActionButton
              icon={Play}
              label="Start"
              tone="success"
              onClick={() => void startWorkflowRun(task.id, run.id)}
            />
          ) : null}
          {!isDiscarded && !isCompleted ? (
            <GhostActionButton
              icon={run.autoRun ? Zap : ZapOff}
              label="Autorun"
              tone={run.autoRun ? 'primary' : 'neutral'}
              pressed={run.autoRun}
              highlighted={run.autoRun}
              ariaLabel={run.autoRun ? 'Autorun on' : 'Autorun off'}
              onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
            />
          ) : null}
          {isDiscarded ? (
            <GhostActionButton
              icon={Undo2}
              label="Restore"
              onClick={() => void restoreWorkflow(task.id, run.id)}
            />
          ) : (
            <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
          )}
          <WorkflowDeleteButton onConfirm={() => void onDeleteWorkflow(run.id)} />
        </CardActionSlot>
      ) : null}
    </div>
  );
};
