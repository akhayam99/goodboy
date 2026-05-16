import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Agent, Step, Workflow } from '@kay-am/types';
import type { VerbosityLevel } from '../../../../features/settings/verbosity';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
} from '../../../../features/session/agent-kind';

export interface WorkflowNextStepCtaProps {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly onAdvance: (
    step: Step,
    model: string,
    verbosity: VerbosityLevel | undefined,
  ) => void | Promise<void>;
  readonly hasOpenQuestions?: boolean;
  readonly consumesActivePlan?: boolean;
  readonly className?: string;
}

/**
 * Reusable lit CTA that surfaces the next un-spawned workflow step once the
 * current step's agent has completed. Hidden when the next step is already
 * spawned (the user can still iterate inside that agent) or when no step
 * remains. Issue #424 wires this into the agents bar; future issues
 * (#425/#426/#428) reuse the same hook point for additional surfaces.
 */
export function pickNextWorkflowStep(workflow: Workflow, runs: ReadonlyArray<Agent>): Step | null {
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
  hasOpenQuestions = false,
  consumesActivePlan = false,
  className,
}: WorkflowNextStepCtaProps) {
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const next = useMemo(() => pickNextWorkflowStep(workflow, runs), [workflow, runs]);
  const kind = useMemo(() => (next ? inferAgentKindFromName(next.name) : 'generic'), [next]);
  const defaults = AGENT_KIND_DEFAULTS[kind];
  const palette = AGENT_KIND_PALETTE[kind];
  if (!next) return null;
  const stepVerbosity = next.verbosity;
  const doAdvance = async () => {
    if (busy) return;
    setBusy(true);
    setPendingConfirm(false);
    try {
      await onAdvance(next, defaults.model, stepVerbosity);
    } finally {
      setBusy(false);
    }
  };
  const onClick = () => {
    if (hasOpenQuestions) {
      setPendingConfirm(true);
    } else {
      void doAdvance();
    }
  };
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        data-testid="workflow-next-step-cta"
        title={`model: ${defaults.model} · effort: ${defaults.effort}${stepVerbosity ? ` · verbosity: ${stepVerbosity}` : ''}`}
        className="group flex w-full items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Start ${next.name} (${defaults.model}, ${defaults.effort} effort${stepVerbosity ? `, ${stepVerbosity} verbosity` : ''})`}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-2xs uppercase tracking-wide opacity-70">start</span>
          <span className="font-semibold">{next.name}</span>
          <span
            className={cn(
              'rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
              palette.bg,
              palette.fg,
            )}
            aria-hidden
          >
            {palette.label}
          </span>
          {consumesActivePlan ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary"
              title="advancing will consume the active plan"
            >
              <ClipboardList size={9} aria-hidden />
              <span>consume plan</span>
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-normal opacity-60">
            {defaults.model.split('-').slice(1, 3).join('-')}
          </span>
          <ArrowRight
            size={13}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </button>
      {pendingConfirm ? (
        <div className="rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]">
          <p className="mb-2 font-medium text-foreground">
            open questions need resolution before spawning an agent.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingConfirm(false)}
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              resolve first
            </button>
            <button
              type="button"
              onClick={() => void doAdvance()}
              className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
            >
              force spawn
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
