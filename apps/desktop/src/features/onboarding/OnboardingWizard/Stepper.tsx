import { cn } from '@goodboy/ui';
import type { OnboardingStepId } from '../onboarding-store';

const CHECKLIST_ID_BY_WIZARD_STEP: Readonly<Record<number, OnboardingStepId | null>> = {
  0: null,
  1: null,
  2: 'workspace',
  3: null,
  4: 'codeHost',
  5: 'tools',
  6: 'tools',
  7: null,
};

type DotState = 'done' | 'current' | 'pending';

type DotStateParams = {
  readonly wizardStep: number;
  readonly position: number;
  readonly currentPosition: number;
  readonly completed: ReadonlySet<OnboardingStepId>;
};

const dotState = ({
  wizardStep,
  position,
  currentPosition,
  completed,
}: DotStateParams): DotState => {
  if (position === currentPosition) {
    return 'current';
  }
  if (position < currentPosition) {
    return 'done';
  }
  const checklistId = CHECKLIST_ID_BY_WIZARD_STEP[wizardStep] ?? null;
  if (checklistId !== null && completed.has(checklistId)) {
    return 'done';
  }
  return 'pending';
};

const DOT_CLASS: Readonly<Record<DotState, string>> = {
  done: 'w-6 bg-primary',
  current: 'w-3 bg-primary/50 ring-1 ring-primary',
  pending: 'w-1.5 bg-border',
};

type Props = {
  readonly current: number;
  readonly steps: ReadonlyArray<number>;
  readonly completed: ReadonlySet<OnboardingStepId>;
};

export const Stepper = ({ current, steps, completed }: Props) => {
  const currentPosition = steps.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {steps.map((wizardStep, position) => {
        const state = dotState({ wizardStep, position, currentPosition, completed });
        return (
          <span
            key={wizardStep}
            data-state={state}
            className={cn('h-1.5 rounded-full motion-safe:transition-all', DOT_CLASS[state])}
          />
        );
      })}
    </div>
  );
};
