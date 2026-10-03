import { AlertTriangle, CircleStop, Link2, Pause } from 'lucide-react';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusSettled } from '@goodboy/core';
import { Chip, StatusDot, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';
import { isRunPaused } from '../../../workflows/isRunPaused';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly hasOrchestratorStrip?: boolean;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly question?: WorkflowRunStatusQuestion | null;
};

type WorkflowRunStatusQuestion = {
  readonly count: number;
  readonly isInView: boolean;
  readonly onReveal: () => void;
};

export const WorkflowRunStatus = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  hasOrchestratorStrip = false,
  blockReason = null,
  question = null,
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

  const baseClass =
    'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-secondary font-medium uppercase tracking-eyebrow';

  if (isDiscarded) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
        <CONCEPT_ICONS.runCancelled size={10} aria-hidden />
        Discarded
      </span>
    );
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')} title="Closed by you">
        <CONCEPT_ICONS.runDone size={10} aria-hidden />
        Closed
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className={cn(baseClass, cn(tintClasses('success').bg, 'text-success'))}>
        <CONCEPT_ICONS.runDone size={10} aria-hidden />
        Completed
      </span>
    );
  }
  const stop = run.orchestrationStop;
  if (isRunPaused({ run }) && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, 'bg-muted text-muted-foreground')}
        title={stop?.message}
        data-testid="workflow-run-paused"
      >
        <Pause size={10} aria-hidden />
        Paused
      </span>
    );
  }
  if (stop?.kind === 'operator' && isOrchestrating && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
        title="Waiting for the decision already in flight"
        data-testid="workflow-orchestrator-stopping"
      >
        <CircleStop size={10} aria-hidden />
        Stopping
      </span>
    );
  }
  if (stop?.kind === 'operator' && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
        title={stop.message}
        data-testid="workflow-orchestrator-stopped"
      >
        <CircleStop size={10} aria-hidden />
        Stopped
      </span>
    );
  }
  if (stop?.kind === 'budget' && !isRunning && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
        title={stop.message}
        data-testid="workflow-orchestrator-budget-paused"
      >
        <Pause size={10} aria-hidden />
        Budget paused
      </span>
    );
  }
  if (stop != null && !isRunning && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, cn(tintClasses('danger').bg, 'text-danger'))}
        title={stop.message}
        data-testid="workflow-orchestrator-failed"
      >
        <AlertTriangle size={10} aria-hidden />
        Orchestrator failed
      </span>
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
  if (blockReason === 'questions' && !hasOrchestratorStrip && question !== null) {
    if (question.isInView) {
      return null;
    }
    const label =
      question.count === 1
        ? '1 question waits on you, show the agent that asked'
        : `${question.count} questions wait on you, show the agents that asked`;
    return (
      <Chip
        as="button"
        tone="warning"
        size="control"
        emphasis="subtle"
        testId="workflow-run-needs-you"
        ariaLabel={label}
        title={label}
        icon={<CONCEPT_ICONS.questions size={ICON_SIZE.row} aria-hidden className="shrink-0" />}
        label={question.count}
        onClick={question.onReveal}
      />
    );
  }
  if (blockReason === 'questions' && !hasOrchestratorStrip) {
    return (
      <span
        className={cn(baseClass, cn(tintClasses('warning').bg, 'text-warning'))}
        title="An open question blocks the next step"
      >
        <CONCEPT_ICONS.questions size={10} aria-hidden />
        Blocked
      </span>
    );
  }
  if (isDeciding && !hasOrchestratorStrip) {
    return (
      <span className={cn(baseClass, cn(tintClasses('primary').bg, 'text-primary'))}>
        <CONCEPT_ICONS.orchestrator size={10} aria-hidden />
        Next step due
      </span>
    );
  }
  if (isQueuedManual) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
        <Pause size={10} aria-hidden />
        Queued
      </span>
    );
  }
  if (isQueuedAfter) {
    return (
      <span
        className={cn(baseClass, 'max-w-40 truncate bg-muted text-muted-foreground')}
        title={`After ${predecessorName}`}
      >
        <Link2 size={10} aria-hidden />
        After {predecessorName}
      </span>
    );
  }
  if (hasOrchestratorStrip) {
    return null;
  }
  return (
    <span className={cn(baseClass, cn(tintClasses('primary').bg, 'text-primary'))}>Ready</span>
  );
};
