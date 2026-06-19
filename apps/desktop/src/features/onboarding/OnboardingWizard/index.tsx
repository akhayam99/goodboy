import { useEffect, useRef, useState } from 'react';
import { Button, cn, type ButtonVariant } from '@goodboy/ui';
import { finishWizard } from '../onboarding-store';
import { useOnboardingWizard } from './useOnboardingWizard';
import { Stepper } from './Stepper';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { WorkspaceStep } from './steps/WorkspaceStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { CodeHostStep } from './steps/CodeHostStep';
import { TrackerStep } from './steps/TrackerStep';
import { SentryStep } from './steps/SentryStep';
import { ReadyStep } from './steps/ReadyStep';

const STEP_COUNT = 8;
const SETUP_START_STEP = 3;
const EXIT_MS = 200;

type Cta = {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: ButtonVariant;
  readonly disabled?: boolean;
};

export const OnboardingWizard = () => {
  const {
    open,
    mode,
    providersConnected,
    hasWorkspace,
    workspaceId,
    githubConnected,
    gitlabConnected,
    hasCodeHost,
    hasLinear,
    hasSentry,
    refreshGithubStatus,
  } = useOnboardingWizard();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const minStep = mode === 'setup' ? SETUP_START_STEP : 0;
  const last = STEP_COUNT - 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(minStep);
    setClosing(false);
    containerRef.current?.focus();
  }, [open, minStep]);

  if (!open) {
    return null;
  }

  const goNext = () => setStep((s) => Math.min(s + 1, last));
  const goBack = () => setStep((s) => Math.max(s - 1, minStep));
  const canSkipSetup = hasWorkspace;
  const dismiss = () => {
    setClosing(true);
    window.setTimeout(finishWizard, EXIT_MS);
  };

  let body = <WelcomeStep />;
  let cta: Cta = { label: 'Get started', onClick: goNext, variant: 'primary' };

  if (step === 1) {
    body = <ProvidersStep />;
    cta = {
      label: 'Continue',
      onClick: goNext,
      variant: 'primary',
      disabled: providersConnected === 0,
    };
  } else if (step === 2) {
    body = <WorkspaceStep hasWorkspace={hasWorkspace} />;
    cta = { label: 'Continue', onClick: goNext, variant: 'primary', disabled: !hasWorkspace };
  } else if (step === 3) {
    body = <PreferencesStep workspaceId={workspaceId} />;
    cta = { label: 'Continue', onClick: goNext, variant: 'primary' };
  } else if (step === 4) {
    body = (
      <CodeHostStep
        workspaceId={workspaceId}
        githubConnected={githubConnected}
        gitlabConnected={gitlabConnected}
        onConnected={refreshGithubStatus}
      />
    );
    cta = hasCodeHost
      ? { label: 'Continue', onClick: goNext, variant: 'primary' }
      : { label: 'Skip for now', onClick: goNext, variant: 'secondary' };
  } else if (step === 5) {
    body = <TrackerStep workspaceId={workspaceId} linearConnected={hasLinear} />;
    cta = hasLinear
      ? { label: 'Continue', onClick: goNext, variant: 'primary' }
      : { label: 'Skip for now', onClick: goNext, variant: 'secondary' };
  } else if (step === 6) {
    body = <SentryStep workspaceId={workspaceId} />;
    cta = hasSentry
      ? { label: 'Continue', onClick: goNext, variant: 'primary' }
      : { label: 'Skip for now', onClick: goNext, variant: 'secondary' };
  } else if (step === 7) {
    body = <ReadyStep />;
    cta = { label: 'Start building', onClick: dismiss, variant: 'primary' };
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goodboy setup"
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-hidden bg-background outline-none',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 45%, var(--color-background) 100%)',
        }}
        aria-hidden
      />

      <header className="relative grid min-h-[3.25rem] shrink-0 grid-cols-3 items-center px-6 pt-5">
        <span aria-hidden />
        <div className="flex justify-center">
          {step > minStep && <Stepper current={step - minStep} total={last - minStep} />}
        </div>
        <div className="flex justify-end">
          {step < last && canSkipSetup && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Skip setup
            </button>
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-xl flex-col gap-8">
            <div key={step} className="motion-safe:animate-fade-in">
              {body}
            </div>
            <div
              className={cn(
                'flex items-center pt-2',
                step > minStep ? 'justify-between' : 'justify-center',
              )}
            >
              {step > minStep && (
                <Button variant="ghost" size="sm" onClick={goBack}>
                  Back
                </Button>
              )}
              <Button variant={cta.variant} onClick={cta.onClick} disabled={cta.disabled}>
                {cta.label}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
