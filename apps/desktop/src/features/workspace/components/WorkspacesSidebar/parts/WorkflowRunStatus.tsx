import { Ban, Check, Link2, Pause, Wand2 } from 'lucide-react';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { StatusDot, cn } from '@goodboy/ui';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
};

export const WorkflowRunStatus = ({ run, workflow, agents, predecessorName }: Props) => {
  const completedSteps = agents.filter(
    (agent) => agent.status === 'completed' || agent.status === 'skipped',
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
    agents.every((agent) => agent.status === 'completed' || agent.status === 'skipped');
  const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && !hasStarted;
  const isQueuedAfter = !isDiscarded && run.triggerMode === 'after_run' && !hasStarted;

  const baseClass =
    'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide';

  if (isDiscarded) {
    return (
      <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
        <Ban size={10} aria-hidden />
        Discarded
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className={cn(baseClass, 'bg-success/10 text-success')}>
        <Check size={10} aria-hidden />
        Completed
      </span>
    );
  }
  if (isRunning) {
    return (
      <span className={cn(baseClass, 'bg-info/10 text-info')}>
        <StatusDot tone="info" size="sm" pulsing />
        Running
      </span>
    );
  }
  if (isDeciding) {
    return (
      <span className={cn(baseClass, 'bg-accent/10 text-accent')}>
        <Wand2 size={10} aria-hidden />
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
        title={`after ${predecessorName}`}
      >
        <Link2 size={10} aria-hidden />
        After {predecessorName}
      </span>
    );
  }
  return <span className={cn(baseClass, 'bg-accent/10 text-accent')}>Ready</span>;
};
