import { cn } from '@goodboy/ui';
import type { OnboardingStepId } from '../onboarding-store';

const CHECKLIST_IDS_BY_WIZARD_STEP: Readonly<Record<number, ReadonlyArray<OnboardingStepId>>> = {
  0: [],
  1: [],
  2: ['workspace'],
  3: ['workspace'],
  4: [],
  5: [],
  6: ['codeHost', 'tools'],
  7: [],
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
  const checklistIds = CHECKLIST_IDS_BY_WIZARD_STEP[wizardStep] ?? [];
  if (checklistIds.length > 0 && checklistIds.some((id) => completed.has(id))) {
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
