import { Check } from 'lucide-react';
import { cn, ICON_SIZE } from '@goodboy/ui';

import {
  NUMBERED_WIZARD_STEPS,
  OPTIONAL_WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  isNumberedStep,
  type WizardStepId,
} from './wizardSteps';

type StepState = 'done' | 'current' | 'later';

type StateParams = {
  readonly position: number;
  readonly currentPosition: number;
};

const stepState = ({ position, currentPosition }: StateParams): StepState => {
  if (position === currentPosition) {
    return 'current';
  }
  if (position < currentPosition) {
    return 'done';
  }
  return 'later';
};

const NODE_CLASS: Readonly<Record<StepState, string>> = {
  done: 'bg-fill text-muted-foreground',
  current: 'bg-primary text-on-tone',
  later: 'ring-1 ring-inset ring-border-soft text-faint-foreground',
};

const LABEL_CLASS: Readonly<Record<StepState, string>> = {
  done: 'text-muted-foreground',
  current: 'text-foreground',
  later: 'text-faint-foreground',
};

type Props = {
  readonly current: WizardStepId;
};

export const stepAnnouncement = ({ current }: Props): string => {
  if (!isNumberedStep(current)) {
    return '';
  }
  const position = NUMBERED_WIZARD_STEPS.indexOf(current);
  return `Step ${position + 1} of ${NUMBERED_WIZARD_STEPS.length}, ${WIZARD_STEP_LABEL[current]}`;
};

export const Stepper = ({ current }: Props) => {
  const currentPosition = isNumberedStep(current) ? NUMBERED_WIZARD_STEPS.indexOf(current) : -1;

  return (
    <nav aria-label="Setup steps" className="flex min-w-0 justify-center">
      <ol className="flex min-w-0 items-center gap-2">
        {NUMBERED_WIZARD_STEPS.map((step, position) => {
          const state = stepState({ position, currentPosition });
          const isLast = position === NUMBERED_WIZARD_STEPS.length - 1;
          return (
            <li
              key={step}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full text-chip motion-safe:transition-colors',
                  NODE_CLASS[state],
                )}
              >
                {state === 'done' ? (
                  <Check
                    size={ICON_SIZE.mark}
                    strokeWidth={2.5}
                    aria-hidden
                    className="wizard-stepper-check"
                  />
                ) : (
                  position + 1
                )}
              </span>
              <span className={cn('truncate text-meta', LABEL_CLASS[state])}>
                {WIZARD_STEP_LABEL[step]}
              </span>
              {OPTIONAL_WIZARD_STEPS.has(step) ? (
                <span className="shrink-0 text-chip text-faint-foreground">Optional</span>
              ) : null}
              {isLast ? null : (
                <span
                  aria-hidden
                  className="relative h-px w-5 shrink-0 overflow-hidden bg-border-soft"
                >
                  <span
                    className={cn(
                      'wizard-stepper-fill absolute inset-0 origin-left bg-border',
                      position < currentPosition ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {stepAnnouncement({ current })}
      </p>
    </nav>
  );
};
