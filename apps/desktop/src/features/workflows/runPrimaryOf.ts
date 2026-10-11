import type { OrchestratorPhase } from './components/OrchestratorStrip/orchestratorState';

export type RunPrimaryKind =
  | 'review-plan'
  | 'approve-plan'
  | 'answer'
  | 'resume'
  | 'continue'
  | 'retry'
  | 'raise-cap'
  | 'decide-next'
  | 'start-step'
  | 'start-run'
  | 'restore';

export type RunPrimary = {
  readonly kind: RunPrimaryKind;
  readonly label: string;
};

export type RunPlanHold = 'none' | 'with-plan' | 'without-plan';

type DynamicFlow = {
  readonly kind: 'dynamic';
  readonly phase: OrchestratorPhase;
  readonly hasQuestion: boolean;
  readonly isAutoRun: boolean;
};

type StaticFlow = {
  readonly kind: 'static';
  readonly isPaused: boolean;
  readonly nextStepNumber: number | null;
};

export type RunFlow = DynamicFlow | StaticFlow;

type Params = {
  readonly isDiscarded: boolean;
  readonly isFinished: boolean;
  readonly isQueuedManual: boolean;
  readonly hold: RunPlanHold;
  readonly flow: RunFlow;
};

const LABELS = {
  'review-plan': 'Review plan',
  'approve-plan': 'Approve plan',
  answer: 'Answer',
  resume: 'Resume',
  continue: 'Continue the run',
  retry: 'Retry',
  'raise-cap': 'Raise spend cap',
  'decide-next': 'Decide next step',
  'start-run': 'Start run',
  restore: 'Restore',
} as const satisfies Record<Exclude<RunPrimaryKind, 'start-step'>, string>;

type FixedParams = {
  readonly kind: keyof typeof LABELS;
};

const fixed = ({ kind }: FixedParams): RunPrimary => ({ kind, label: LABELS[kind] });

type PlanEntryParams = {
  readonly hold: RunPlanHold;
};

const planEntry = ({ hold }: PlanEntryParams): RunPrimary | null => {
  if (hold === 'with-plan') {
    return fixed({ kind: 'review-plan' });
  }
  return hold === 'without-plan' ? fixed({ kind: 'approve-plan' }) : null;
};

type DynamicParams = {
  readonly flow: DynamicFlow;
  readonly hold: RunPlanHold;
};

const dynamicPrimary = ({ flow, hold }: DynamicParams): RunPrimary | null => {
  switch (flow.phase) {
    case 'plan-question':
    case 'needs-answer':
      return flow.hasQuestion ? fixed({ kind: 'answer' }) : planEntry({ hold });
    case 'plan-approval':
    case 'plan-revising':
      return planEntry({ hold });
    case 'paused':
      return fixed({ kind: 'resume' });
    case 'stopped':
      return fixed({ kind: 'continue' });
    case 'failed':
    case 'blocked':
      return fixed({ kind: 'retry' });
    case 'paused-budget':
      return fixed({ kind: 'raise-cap' });
    case 'ready-first':
    case 'ready-mid':
      return flow.isAutoRun ? null : fixed({ kind: 'decide-next' });
    case 'done':
    case 'deciding':
    case 'stopping':
    case 'waiting':
    case 'automatic':
    case 'needs-approval':
    case 'step-failed':
      return null;
    default: {
      const exhaustive: never = flow.phase;
      return exhaustive;
    }
  }
};

export const runPrimaryOf = ({
  isDiscarded,
  isFinished,
  isQueuedManual,
  hold,
  flow,
}: Params): RunPrimary | null => {
  if (isDiscarded) {
    return fixed({ kind: 'restore' });
  }
  if (isFinished) {
    return null;
  }
  if (isQueuedManual) {
    return fixed({ kind: 'start-run' });
  }
  if (flow.kind === 'dynamic') {
    return dynamicPrimary({ flow, hold });
  }
  const entry = planEntry({ hold });
  if (entry !== null) {
    return entry;
  }
  if (flow.isPaused) {
    return fixed({ kind: 'resume' });
  }
  if (flow.nextStepNumber === null) {
    return null;
  }
  return { kind: 'start-step', label: `Start step ${flow.nextStepNumber}` };
};
