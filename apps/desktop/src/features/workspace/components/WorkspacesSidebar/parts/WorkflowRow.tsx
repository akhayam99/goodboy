import { Fragment, type Dispatch, type SetStateAction } from 'react';
import { cn } from '@goodboy/ui';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Play,
  Workflow as WorkflowIcon,
  Zap,
  ZapOff,
} from 'lucide-react';
import type {
  Agent,
  AgentId,
  Session,
  TelemetryRecord,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import {
  kindRouting,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../../../features/session/agent-kind';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetrics';
import { WorkflowNextStepCta } from '../../../../../features/workflows/components/WorkflowNextStepCta';
import { WorkflowStepStrip } from '../../../../../features/workflows/components/WorkflowStepStrip';
import { GoalAttachmentsStrip } from '../../../../../features/context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { CostBadge } from '../../../../providers/components/CostBadge';
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
  const orchestrateNextStep = useAppStore((s) => s.orchestrateNextStep);
  const retryWorkflowOrchestration = useAppStore((s) => s.retryWorkflowOrchestration);
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
  const isDynamicActionable =
    isDynamic &&
    !isDiscarded &&
    run.triggerMode === 'immediate' &&
    run.orchestrationOutcome !== 'done' &&
    !wfAgents.some((a) => a.status === 'pending' || a.status === 'running');
  const unreadCount = countUnread(wfAgents);
  const isDetail = variant === 'detail';
  const expanded = isDetail
    ? true
    : focusedWorkflowRunId != null
      ? run.id === focusedWorkflowRunId
      : (workflowExpand?.[run.id] ?? (!isDiscarded && (!isCompleted || unreadCount > 0)));
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
  const isDynamicDeciding = isDynamicActionable && run.orchestrationOutcome == null;
  const currentStepName =
    wfAgents.find((agent) => agent.status === 'running')?.name ??
    workflow.steps.find((step) => step.id === actionableStepId)?.name ??
    (isDynamicDeciding ? 'deciding next step' : undefined);
  return (
    <div
      className={cn(
        'flex flex-col',
        isDetail ? 'gap-4' : forceExpanded && 'gap-1.5',
        isDiscarded && 'opacity-70',
      )}
    >
      <div className={cn('flex gap-2', isDetail ? 'items-start' : 'items-center gap-0.5')}>
        {isDetail ? (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <WorkflowIcon size={17} aria-hidden className="text-accent" />
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
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {total > 0 ? (
                  <>
                    <span className="tabular-nums">
                      Step {Math.min(done + 1, total)} of {total}
                    </span>
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  </>
                ) : null}
                {currentStepName != null && !isCompleted ? (
                  <>
                    <span className="min-w-0 truncate">{currentStepName}</span>
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  </>
                ) : null}
                <CostBadge value={runCostUsd} title={`$${runCostUsd.toFixed(4)} for this run`} />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleWorkflowExpand(task.id, run.id, expanded)}
            title={workflow.name || name}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'collapse' : 'expand'} ${name} workflow`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-muted/50"
          >
            {expanded ? (
              <ChevronDown size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            ) : (
              <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            )}
            {forceExpanded ? (
              <WorkflowIcon size={13} aria-hidden className="shrink-0 text-accent" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {name}
            </span>
            {unreadCount > 0 ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                title={`${unreadCount} agent ${unreadCount === 1 ? 'reply' : 'replies'} to review`}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                {unreadCount}
              </span>
            ) : null}
            <WorkflowRunStatus
              run={run}
              workflow={workflow}
              agents={wfAgents}
              predecessorName={predecessorName}
            />
            {total > 0 ? (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                {done}/{total}
              </span>
            ) : null}
          </button>
        )}
        {isDetail ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {isQueuedManual ? (
              <button
                type="button"
                onClick={() => void startWorkflowRun(task.id, run.id)}
                className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-success transition-colors hover:bg-success/15"
              >
                <Play size={14} aria-hidden />
                Start
              </button>
            ) : null}
            {!isDiscarded && !isCompleted ? (
              <button
                type="button"
                onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                title={run.autoRun ? 'autorun on, click to pause' : 'autorun off, click to enable'}
                aria-label={run.autoRun ? 'autorun on' : 'autorun off'}
                aria-pressed={run.autoRun}
                className={cn(
                  'inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold transition-colors',
                  run.autoRun
                    ? 'text-danger hover:bg-danger/15'
                    : 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
                )}
              >
                {run.autoRun ? <Zap size={14} aria-hidden /> : <ZapOff size={14} aria-hidden />}
                Autorun
              </button>
            ) : null}
            {!isDiscarded ? (
              <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
            ) : null}
            <WorkflowDeleteButton onConfirm={() => void onDeleteWorkflow(run.id)} />
          </div>
        ) : null}
        {!isDetail && !isDiscarded && !isCompleted && (
          <div className="flex shrink-0 items-center">
            {isQueuedManual ? (
              <button
                type="button"
                onClick={() => void startWorkflowRun(task.id, run.id)}
                title="start this workflow now"
                aria-label="start workflow now"
                className="rounded p-0.5 text-success transition-colors hover:bg-success/15"
              >
                <Play size={11} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
              title={run.autoRun ? 'autorun on, click to pause' : 'autorun off, click to enable'}
              aria-label={run.autoRun ? 'autorun on' : 'autorun off'}
              aria-pressed={run.autoRun}
              className={cn(
                'rounded p-0.5 transition-colors',
                run.autoRun
                  ? 'text-danger hover:bg-danger/15'
                  : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
              )}
            >
              {run.autoRun ? <Zap size={11} aria-hidden /> : <ZapOff size={11} aria-hidden />}
            </button>
            {attachedRuns.length > 1 && (
              <>
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => void onReorderWorkflow(run.id, 'up')}
                  title="move workflow up"
                  aria-label="move workflow up"
                  className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp size={11} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => void onReorderWorkflow(run.id, 'down')}
                  title="move workflow down"
                  aria-label="move workflow down"
                  className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown size={11} aria-hidden />
                </button>
              </>
            )}
            <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
          </div>
        )}
        {!isDetail && !isDiscarded && isCompleted && (
          <div className="flex shrink-0 items-center">
            <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
          </div>
        )}
      </div>
      {isDetail && expanded ? (
        <div className="flex flex-col gap-2">
          <WorkflowRunAsk
            goal={(run.goal ?? workflow.goal ?? '').trim()}
            processText={(workflow.processText ?? '').trim()}
          />
          <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
        </div>
      ) : null}
      {expanded ? (
        wfAgents.length > 0 ? (
          isDetail ? (
            <WorkflowStepStrip
              workflow={workflow}
              runs={wfAgents}
              childrenByParentId={childrenByParentId}
              agentKindOverride={agentKindOverride}
              agentModelOverride={agentModelOverride}
              roleModels={roleModels}
              selectedAgentId={selectedAgentId}
              onSelect={onPickAgent}
            />
          ) : (
            <div className={cn('flex flex-col gap-1 pb-1', forceExpanded ? 'pl-1' : 'pl-3')}>
              {wfAgents.map((run, index) => {
                const isActionable = run.stepId === actionableStepId && run.status === 'pending';
                const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
                const step = run.stepId != null ? stepById.get(run.stepId) : undefined;
                const stepModel = step?.modelOverride;
                const resolvedModel =
                  stepModel ??
                  agentModelOverride[run.id] ??
                  run.modelOverride ??
                  kindRouting({ kind, roleModels }).model;
                const clusterChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
                const clustersExpanded = clusterExpand.get(run.id) ?? false;
                const clusterUnread = countUnread(clusterChildren);
                return (
                  <Fragment key={run.id}>
                    <WorkflowStepRow
                      run={run}
                      kind={kind}
                      index={index}
                      resolvedModel={resolvedModel}
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
                          aria-label={`${clustersExpanded ? 'collapse' : 'expand'} clusters for ${run.name}`}
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
                              className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning"
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
                                costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
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
      (isDetail || wfBlockReason === 'failed-step' || isDynamicActionable) ? (
        <div className={cn('pb-1', !isDetail && (forceExpanded ? 'pl-1' : 'pl-3'))}>
          <WorkflowNextStepCta
            workflow={workflow}
            runs={wfAgents}
            roleModels={roleModels}
            blockReason={wfBlockReason}
            run={run}
            onOrchestrate={() => void orchestrateNextStep(task.id, run.id)}
            onRetryOrchestration={() => void retryWorkflowOrchestration(task.id, run.id)}
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
  );
};
