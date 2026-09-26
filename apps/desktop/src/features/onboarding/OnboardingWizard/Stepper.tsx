import { Check } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import {
  WIZARD_STEP_LABEL,
  isNumberedStep,
  type NumberedWizardStepId,
  type WizardStepId,
} from './wizardSteps';

type StepState = 'done' | 'current' | 'later';

const NODE_SIZE = 18;

const stepState = ({
  position,
  currentPosition,
}: {
  readonly position: number;
  readonly currentPosition: number;
}): StepState => {
  if (position === currentPosition) {
    return 'current';
  }
  if (position < currentPosition) {
    return 'done';
  }
  return 'later';
};

const primaryTint = tintClasses('primary');

type Props = {
  readonly current: WizardStepId;
  readonly steps: ReadonlyArray<WizardStepId>;
};

export const stepAnnouncement = ({ current, steps }: Props): string => {
  const numbered = steps.filter(isNumberedStep);
  if (!isNumberedStep(current)) {
    return '';
  }
  const position = numbered.indexOf(current);
  if (position < 0) {
    return '';
  }
  return `Step ${position + 1} of ${numbered.length}, ${WIZARD_STEP_LABEL[current]}`;
};

export const Stepper = ({ current, steps }: Props) => {
  const numbered: ReadonlyArray<NumberedWizardStepId> = steps.filter(isNumberedStep);
  const currentPosition = isNumberedStep(current) ? numbered.indexOf(current) : -1;

  return (
    <nav aria-label="Setup steps" className="flex min-w-0 justify-center">
      <ol className="flex min-w-0 items-center gap-2">
        {numbered.map((step, position) => {
          const state = stepState({ position, currentPosition });
          const isLast = position === numbered.length - 1;
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
                  'flex shrink-0 items-center justify-center rounded-full border text-meta',
                  state === 'done' && cn('border-transparent bg-hover text-foreground'),
                  state === 'current' && cn(primaryTint.solid, primaryTint.border),
                  state === 'later' && 'border-border-soft text-faint-foreground',
                )}
                style={{ width: NODE_SIZE, height: NODE_SIZE }}
              >
                {state === 'done' ? (
                  <Check size={ICON_SIZE.row} aria-hidden className="wizard-stepper-check" />
                ) : (
                  position + 1
                )}
              </span>
              <span
                className={cn(
                  'truncate text-label',
                  state === 'later' ? 'text-faint-foreground' : 'text-foreground',
                )}
              >
                {WIZARD_STEP_LABEL[step]}
              </span>
              {isLast ? null : (
                <span
                  aria-hidden
                  className="relative h-px w-5 shrink-0 overflow-hidden bg-border-soft"
                >
                  <span
                    className={cn(
                      'wizard-stepper-fill absolute inset-0 origin-left bg-muted-foreground',
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
        {stepAnnouncement({ current, steps })}
      </p>
    </nav>
  );
};
