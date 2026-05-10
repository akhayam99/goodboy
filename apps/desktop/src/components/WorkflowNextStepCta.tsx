import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Session, Step, Workflow } from '@kay-am/types';

export interface WorkflowNextStepCtaProps {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Session>;
  readonly onAdvance: (step: Step) => void | Promise<void>;
  readonly className?: string;
}

/**
 * Reusable lit CTA that surfaces the next un-spawned workflow step once the
 * current step's agent has completed. Hidden when the next step is already
 * spawned (the user can still iterate inside that agent) or when no step
 * remains. Issue #424 wires this into the agents bar; future issues
 * (#425/#426/#428) reuse the same hook point for additional surfaces.
 */
export function pickNextWorkflowStep(
  workflow: Workflow,
  runs: ReadonlyArray<Session>,
): Step | null {
  const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
  const spawnedIds = new Set(
    runs.map((r) => r.stepId).filter((id): id is Step['id'] => id !== undefined),
  );
  const next = sorted.find((s) => !spawnedIds.has(s.id));
  if (!next) return null;
  const prevSpawned = sorted.filter((s) => s.ordinal < next.ordinal);
  if (prevSpawned.length === 0) return next;
  const prevAllCompleted = prevSpawned.every((s) =>
    runs.some((r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped')),
  );
  return prevAllCompleted ? next : null;
}

export function WorkflowNextStepCta({
  workflow,
  runs,
  onAdvance,
  className,
}: WorkflowNextStepCtaProps) {
  const [busy, setBusy] = useState(false);
  const next = useMemo(() => pickNextWorkflowStep(workflow, runs), [workflow, runs]);
  if (!next) return null;
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAdvance(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      data-testid="workflow-next-step-cta"
      className={cn(
        'group flex w-full items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      aria-label={`Start ${next.name}`}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wide opacity-70">start</span>
        <span className="font-semibold">{next.name}</span>
      </span>
      <ArrowRight
        size={13}
        aria-hidden
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
