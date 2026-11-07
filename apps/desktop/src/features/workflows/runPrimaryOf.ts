import { NAMES } from '../../shared/utils/names';
import { planApproveLabelOf } from '../plans/planApproveLabelOf';
import type { OrchestratorPhase } from './orchestratorState';

export type RunPrimaryKind =
  | 'review-plan'
  | 'approve-plan'
  | 'answer'
  | 'resume'
  | 'continue'
  | 'retry'
  | 'hint'
  | 'raise-cap'
  | 'decide-next'
  | 'start-step'
  | 'open-step'
  | 'start-run'
  | 'restore';

export type RunPrimary = {
  readonly kind: RunPrimaryKind;
  readonly label: string;
};

export type RunPlanHold = 'none' | 'with-plan' | 'without-plan' | 'revising';

type DynamicFlow = {
  readonly kind: 'dynamic';
  readonly phase: OrchestratorPhase;
  readonly hasQuestion: boolean;
  readonly isAutoRun: boolean;
  readonly haltedStepNumber?: number | null;
};

type HaltedStep = {
  readonly number: number | null;
};

type StaticFlow = {
  readonly kind: 'static';
  readonly isPaused: boolean;
  readonly nextStepNumber: number | null;
  readonly nextStepName?: string | null;
  readonly haltedStep?: HaltedStep | null;
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
  answer: 'Answer',
  resume: NAMES.continue,
  continue: NAMES.continue,
  retry: 'Retry',
  hint: 'Add a hint and continue',
  'raise-cap': 'Raise limit',
  'decide-next': 'Decide next step',
  'start-run': 'Start run',
  restore: 'Restore',
} as const satisfies Record<
  Exclude<RunPrimaryKind, 'start-step' | 'open-step' | 'approve-plan'>,
  string
>;

type FixedParams = {
  readonly kind: keyof typeof LABELS;
};

const fixed = ({ kind }: FixedParams): RunPrimary => ({ kind, label: LABELS[kind] });

type PlanEntryParams = {
  readonly hold: RunPlanHold;
  readonly nextStepName: string | null;
};

const planEntry = ({ hold, nextStepName }: PlanEntryParams): RunPrimary | null => {
  if (hold === 'with-plan') {
    return fixed({ kind: 'review-plan' });
  }
  return hold === 'without-plan'
    ? { kind: 'approve-plan', label: planApproveLabelOf({ nextStepName }) }
    : null;
};

type OpenStepLabelParams = {
  readonly number: number | null;
};

export const openStepLabelOf = ({ number }: OpenStepLabelParams): string =>
  number === null ? 'Open step' : `Open step ${number}`;

type DynamicParams = {
  readonly flow: DynamicFlow;
  readonly hold: RunPlanHold;
};

const dynamicPrimary = ({ flow, hold }: DynamicParams): RunPrimary | null => {
  switch (flow.phase) {
    case 'plan-question':
    case 'needs-answer':
      return flow.hasQuestion ? fixed({ kind: 'answer' }) : planEntry({ hold, nextStepName: null });
    case 'plan-approval':
      return planEntry({ hold, nextStepName: null });
    case 'plan-revising':
      return null;
    case 'paused':
      return fixed({ kind: 'resume' });
    case 'stopped':
      return fixed({ kind: 'continue' });
    case 'failed':
      return fixed({ kind: 'retry' });
    case 'blocked':
      return fixed({ kind: 'hint' });
    case 'paused-budget':
      return fixed({ kind: 'raise-cap' });
    case 'ready-first':
    case 'ready-mid':
      return flow.isAutoRun ? null : fixed({ kind: 'decide-next' });
    case 'step-failed':
      return {
        kind: 'open-step',
        label: openStepLabelOf({ number: flow.haltedStepNumber ?? null }),
      };
    case 'done':
    case 'deciding':
    case 'stopping':
    case 'waiting':
    case 'automatic':
    case 'needs-approval':
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
  if (hold === 'revising') {
    return null;
  }
  if (flow.kind === 'dynamic') {
    return dynamicPrimary({ flow, hold });
  }
  const entry = planEntry({ hold, nextStepName: flow.nextStepName ?? null });
  if (entry !== null) {
    return entry;
  }
  if (flow.isPaused) {
    return fixed({ kind: 'resume' });
  }
  if (flow.haltedStep != null) {
    return { kind: 'open-step', label: openStepLabelOf({ number: flow.haltedStep.number }) };
  }
  if (flow.nextStepNumber === null) {
    return null;
  }
  return { kind: 'start-step', label: `Start step ${flow.nextStepNumber}` };
};
