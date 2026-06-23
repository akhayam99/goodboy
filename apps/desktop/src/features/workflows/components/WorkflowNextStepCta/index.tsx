import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, Step, Workflow } from '@goodboy/types';
import type { VerbosityLevel } from '../../../../features/settings/verbosity';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
} from '../../../../features/session/agent-kind';
import { shortModel } from '../../../../features/session/agent-row-format';

export type Props = {
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
};

export type PickNextWorkflowStepGate = {
  readonly hasOpenQuestions?: boolean;
  readonly summarizerBusy?: boolean;
};

export const pickNextWorkflowStep = (
  workflow: Workflow,
  runs: ReadonlyArray<Agent>,
  gate?: PickNextWorkflowStepGate,
): Step | null => {
  if (gate?.hasOpenQuestions || gate?.summarizerBusy) {
    return null;
  }
  const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
  for (const step of sorted) {
    const agent = runs.find((r) => r.stepId === step.id);
    if (!agent || agent.status !== 'pending') {
      continue;
    }
    const prevSteps = sorted.filter((s) => s.ordinal < step.ordinal);
    const allDone = prevSteps.every((s) =>
      runs.some((r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped')),
    );
    if (allDone) {
      return step;
    }
    return null;
  }
  return null;
};

export const WorkflowNextStepCta = ({
  workflow,
  runs,
  onAdvance,
  hasOpenQuestions = false,
  consumesActivePlan = false,
  className,
}: Props) => {
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const next = useMemo(() => pickNextWorkflowStep(workflow, runs), [workflow, runs]);
  const kind = useMemo(() => (next ? inferAgentKindFromName(next.name) : 'generic'), [next]);
  const defaults = AGENT_KIND_DEFAULTS[kind];
  const palette = AGENT_KIND_PALETTE[kind];
  if (!next) {
    return null;
  }
  const stepVerbosity = next.verbosity;
  const doAdvance = async () => {
    if (busy) {
      return;
    }
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
        className="group flex w-full items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:border-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Start ${next.name} (${defaults.model}, ${defaults.effort} effort${stepVerbosity ? `, ${stepVerbosity} verbosity` : ''})`}
      >
        <span className="flex items-center gap-1.5">
          <ArrowRight
            size={13}
            aria-hidden
            className="shrink-0 motion-safe:transition-transform group-hover:translate-x-0.5"
          />
          <span className="font-semibold">{next.name}</span>
          <span
            className={cn(
              'rounded px-1 py-0.5 text-2xs font-semibold uppercase leading-none tracking-eyebrow text-background',
              palette.bg,
            )}
            aria-hidden
          >
            {palette.label}
          </span>
          {consumesActivePlan ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 py-0.5 text-2xs font-semibold uppercase leading-none tracking-eyebrow text-primary"
              title="advancing will consume the active plan"
            >
              <ClipboardList size={9} aria-hidden />
              <span>consume plan</span>
            </span>
          ) : null}
        </span>
        <span className="text-2xs font-normal tabular-nums opacity-60">
          {shortModel(defaults.model)}
        </span>
      </button>
      {pendingConfirm ? (
        <div className="flex flex-col gap-2 rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-2xs">
          <p className="font-medium text-foreground">
            Answer the open questions before you start the next agent.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingConfirm(false)}
              className="rounded bg-warning px-2 py-0.5 text-2xs font-semibold text-warning-foreground motion-safe:transition-opacity hover:opacity-90"
            >
              answer first
            </button>
            <button
              type="button"
              onClick={() => void doAdvance()}
              className="rounded border border-border px-2 py-0.5 text-2xs font-semibold text-foreground motion-safe:transition-colors hover:bg-muted"
            >
              start anyway
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
