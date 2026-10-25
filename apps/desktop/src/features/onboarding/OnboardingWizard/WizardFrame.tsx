import { useEffect, useRef, useState } from 'react';
import { ScrollFade, cn, useEscapeLayer } from '@goodboy/ui';
import {
  enterWizardStep,
  finishWizard,
  markStepComplete,
  pauseWizard,
} from '../onboardingSettings';
import type { OnboardingWizardState } from './useOnboardingWizard';
import { useStepTransition } from './useStepTransition';
import { StepTransition } from './StepTransition';
import { WizardHeader } from './WizardHeader';
import { WizardStepBody } from './WizardStepBody';
import {
  firstWizardStep,
  isNumberedStep,
  visibleWizardSteps,
  type FinishParams,
  type GoToParams,
  type WizardNav,
  type WizardStepId,
} from './wizardSteps';

const WIZARD_EXIT_MS = 200;

const WIZARD_COLUMN_CLASS = 'flex w-full max-w-[600px] flex-col gap-6';

type Outcome = 'later' | 'done' | 'closed';

type LeaveParams = {
  readonly outcome: Outcome;
  readonly after?: () => void;
};

type Props = Omit<OnboardingWizardState, 'isOpen' | 'close'> & {
  readonly onClose: () => void;
};

export const WizardFrame = ({ onClose, ...wizard }: Props) => {
  const { mode, start } = wizard;
  const steps = visibleWizardSteps({ mode, start });
  const [step, setStep] = useState<WizardStepId>(() => firstWizardStep({ mode, start }));
  const [isOpenedOnCover] = useState(() => firstWizardStep({ mode, start }) === 'welcome');
  const [isBusy, setIsBusy] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const transition = useStepTransition({ step, order: steps });

  const stepIndex = steps.indexOf(step);
  const isLocked = isBusy || isClosing || transition.isTransitioning;
  const isCover = step === 'welcome';

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (mode === 'single' || !isNumberedStep(step)) {
      return;
    }
    void enterWizardStep({ step });
  }, [mode, step]);

  const goTo = ({ step: next }: GoToParams) => {
    if (transition.isTransitioning || isClosing || !steps.includes(next)) {
      return;
    }
    setStep(next);
  };

  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next === undefined) {
      return;
    }
    if (step === 'tools' && mode !== 'single') {
      markStepComplete('tools');
    }
    goTo({ step: next });
  };

  const previous = steps[stepIndex - 1];
  const goBack = previous === undefined ? null : () => goTo({ step: previous });

  const leave = ({ outcome, after }: LeaveParams) => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    window.setTimeout(() => {
      if (outcome === 'later') {
        void pauseWizard();
      }
      if (outcome === 'done') {
        void finishWizard();
      }
      after?.();
      onClose();
    }, WIZARD_EXIT_MS);
  };

  const finish = (params?: FinishParams) =>
    leave({ outcome: mode === 'single' ? 'closed' : 'done', after: params?.after });

  const later = (params?: FinishParams) =>
    leave({ outcome: mode === 'single' ? 'closed' : 'later', after: params?.after });

  const onLeaveFromHeader = () => later();

  useEscapeLayer(() => {
    if (isLocked) {
      return;
    }
    if (mode === 'single') {
      leave({ outcome: 'closed' });
      return;
    }
    goBack?.();
  });

  const nav: WizardNav = {
    mode,
    step,
    isFirst: stepIndex <= 0,
    isLast: stepIndex === steps.length - 1,
    isLocked,
    goNext,
    goBack,
    goTo,
    finish,
    later,
    setBusy: setIsBusy,
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goodboy setup"
      tabIndex={-1}
      data-step={step}
      className={cn(
        'fixed inset-0 z-onboarding grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background outline-none',
        isClosing && 'motion-safe:animate-studio-out',
        !isClosing &&
          (isOpenedOnCover ? 'welcome-entrance-frame' : 'motion-safe:animate-studio-in'),
      )}
    >
      <div
        aria-hidden
        data-testid="wizard-backdrop"
        data-state={isCover ? 'shown' : 'hidden'}
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 bg-backdrop-cover motion-safe:transition-opacity motion-safe:duration-200',
          isCover ? 'opacity-100' : 'opacity-0',
        )}
      />
      <WizardHeader
        mode={mode}
        step={step}
        isLocked={isBusy || isClosing}
        onLeave={onLeaveFromHeader}
      />
      <ScrollFade className="min-h-0">
        <div
          className={cn(
            'flex min-h-full flex-col items-center px-6 pb-10',
            isCover ? 'justify-center' : 'pt-16',
          )}
        >
          <div data-testid="wizard-column" className={WIZARD_COLUMN_CLASS}>
            <StepTransition
              transition={transition}
              renderStep={(id) => <WizardStepBody step={id} nav={nav} wizard={wizard} />}
            />
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
