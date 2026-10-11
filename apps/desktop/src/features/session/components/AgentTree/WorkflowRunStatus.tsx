import { AlertTriangle, CircleStop, ClipboardCheck, Link2, Pause } from 'lucide-react';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusSettled } from '@goodboy/core';
import { StatusDot, cn, tintClasses, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';
import { isRunPaused } from '../../../workflows/isRunPaused';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly hasOrchestratorStrip?: boolean;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly isQuestionShownBelow?: boolean;
};

export const WorkflowRunStatus = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  hasOrchestratorStrip = false,
  blockReason = null,
  isQuestionShownBelow = false,
}: Props) => {
  const completedSteps = agents.filter((agent) =>
    isAgentStatusSettled({ status: agent.status }),
  ).length;
  const isDiscarded = run.discardedAt != null;
  const isDynamic = run.executionMode === 'dynamic';
  const isCompleted =
    !isDiscarded &&
    (isDynamic
      ? run.orchestrationOutcome === 'done'
      : workflow.steps.length > 0 && completedSteps >= workflow.steps.length);
  const isRunning = agents.some((agent) => agent.status === 'running');
  const hasStarted = agents.length > 0;
  const isDeciding =
    !isDiscarded &&
    isDynamic &&
    run.orchestrationOutcome == null &&
    hasStarted &&
    !isRunning &&
    agents.every((agent) => isAgentStatusSettled({ status: agent.status }));
  const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && !hasStarted;
  const isQueuedAfter = !isDiscarded && run.triggerMode === 'after_run' && !hasStarted;

  const baseClass = 'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-eyebrow';

  if (isDiscarded) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
        <CONCEPT_ICONS.runCancelled size={ICON_SIZE.mark} aria-hidden />
        Discarded
      </span>
    );
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return (
      <Tooltip content="Closed by you">
        <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
          <CONCEPT_ICONS.runDone size={ICON_SIZE.mark} aria-hidden />
          Closed
        </span>
      </Tooltip>
    );
  }
  if (isCompleted) {
    return (
      <span className={cn(baseClass, cn(tintClasses('success').bg, 'text-success'))}>
        <CONCEPT_ICONS.runDone size={ICON_SIZE.mark} aria-hidden />
        Completed
      </span>
    );
  }
  const stop = run.orchestrationStop;
  if (isRunPaused({ run }) && !hasOrchestratorStrip) {
    return (
      <Tooltip content={stop?.message}>
        <span
          className={cn(baseClass, 'bg-muted text-muted-foreground')}
          data-testid="workflow-run-paused"
        >
          <Pause size={ICON_SIZE.mark} aria-hidden />
          Paused
        </span>
      </Tooltip>
    );
  }
  if (isRunHeldForPlan({ run }) && !hasOrchestratorStrip) {
    return (
      <Tooltip content={stop?.message}>
        <span
          className={cn(baseClass, cn(tintClasses('info').bg, 'text-info'))}
          data-testid="workflow-run-plan-ready"
        >
          <ClipboardCheck size={ICON_SIZE.mark} aria-hidden />
          Plan ready
        </span>
      </Tooltip>
    );
  }
  if (stop?.kind === 'operator' && isOrchestrating && !hasOrchestratorStrip) {
    return (
      <Tooltip content="Waiting for the decision already in flight">
        <span
          className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
          data-testid="workflow-orchestrator-stopping"
        >
          <CircleStop size={ICON_SIZE.mark} aria-hidden />
          Stopping
        </span>
      </Tooltip>
    );
  }
  if (stop?.kind === 'operator' && !hasOrchestratorStrip) {
    return (
      <Tooltip content={stop.message}>
        <span
          className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
          data-testid="workflow-orchestrator-stopped"
        >
          <CircleStop size={ICON_SIZE.mark} aria-hidden />
          Stopped
        </span>
      </Tooltip>
    );
  }
  if (stop?.kind === 'budget' && !isRunning && !hasOrchestratorStrip) {
    return (
      <Tooltip content={stop.message}>
        <span
          className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
          data-testid="workflow-orchestrator-budget-paused"
        >
          <Pause size={ICON_SIZE.mark} aria-hidden />
          Budget paused
        </span>
      </Tooltip>
    );
  }
  if (stop != null && !isRunning && !hasOrchestratorStrip) {
    return (
      <Tooltip content={stop.message}>
        <span
          className={cn(baseClass, cn(tintClasses('danger').bg, 'text-danger'))}
          data-testid="workflow-orchestrator-failed"
        >
          <AlertTriangle size={ICON_SIZE.mark} aria-hidden />
          Orchestrator failed
        </span>
      </Tooltip>
    );
  }
  if (isRunning && !hasOrchestratorStrip) {
    return (
      <span className={cn(baseClass, cn(tintClasses('info').bg, 'text-info'))}>
        <StatusDot tone="info" size="sm" pulsing />
        Running
      </span>
    );
  }
  if (blockReason === 'questions' && !hasOrchestratorStrip && isQuestionShownBelow) {
    return null;
  }
  if (blockReason === 'questions' && !hasOrchestratorStrip) {
    return (
      <Tooltip content="An open question blocks the next step">
        <span className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}>
          <CONCEPT_ICONS.questions size={ICON_SIZE.mark} aria-hidden />
          Blocked
        </span>
      </Tooltip>
    );
  }
  if (isDeciding && !hasOrchestratorStrip) {
    return (
      <span className={cn(baseClass, cn(tintClasses('primary').bg, 'text-primary'))}>
        <CONCEPT_ICONS.orchestrator size={ICON_SIZE.mark} aria-hidden />
        Next step due
      </span>
    );
  }
  if (isQueuedManual) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
        <Pause size={ICON_SIZE.mark} aria-hidden />
        Queued
      </span>
    );
  }
  if (isQueuedAfter) {
    return (
      <Tooltip content={`After ${predecessorName}`}>
        <span className={cn(baseClass, 'max-w-40 truncate bg-muted text-muted-foreground')}>
          <Link2 size={ICON_SIZE.mark} aria-hidden />
          After {predecessorName}
        </span>
      </Tooltip>
    );
  }
  if (hasOrchestratorStrip) {
    return null;
  }
  return (
    <span className={cn(baseClass, cn(tintClasses('primary').bg, 'text-primary'))}>Ready</span>
  );
};
