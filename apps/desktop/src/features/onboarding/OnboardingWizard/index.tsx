import { useEffect, useRef, useState } from 'react';
import { Button, cn, type ButtonVariant } from '@goodboy/ui';
import { finishWizard } from '../onboarding-store';
import { useOnboardingWizard } from './useOnboardingWizard';
import { Stepper } from './Stepper';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { WorkspaceStep } from './steps/WorkspaceStep';
import { ReadyStep } from './steps/ReadyStep';

const STEP_COUNT = 4;
const EXIT_MS = 200;

interface Cta {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: ButtonVariant;
}

export function OnboardingWizard() {
  const { open, providersConnected, hasWorkspace } = useOnboardingWizard();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setClosing(false);
    containerRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const last = STEP_COUNT - 1;
  const goNext = () => setStep((s) => Math.min(s + 1, last));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const dismiss = () => {
    setClosing(true);
    window.setTimeout(finishWizard, EXIT_MS);
  };

  let body = <WelcomeStep />;
  let cta: Cta = { label: 'Get started', onClick: goNext, variant: 'primary' };

  if (step === 1) {
    body = <ProvidersStep />;
    cta =
      providersConnected > 0
        ? { label: 'Continue', onClick: goNext, variant: 'primary' }
        : { label: 'Skip for now', onClick: goNext, variant: 'secondary' };
  } else if (step === 2) {
    body = <WorkspaceStep hasWorkspace={hasWorkspace} />;
    cta = hasWorkspace
      ? { label: 'Continue', onClick: goNext, variant: 'primary' }
      : { label: 'Skip for now', onClick: goNext, variant: 'secondary' };
  } else if (step === 3) {
    body = <ReadyStep />;
    cta = { label: 'Start using Goodboy', onClick: dismiss, variant: 'primary' };
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

      <header className="relative flex shrink-0 items-center justify-end px-6 pt-5">
        {step < last ? (
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Skip setup
          </button>
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-xl flex-col gap-8">
            {step > 0 ? <Stepper current={step} total={last} /> : null}
            <div key={step} className="motion-safe:animate-fade-in">
              {body}
            </div>
            <div
              className={cn(
                'flex items-center pt-2',
                step > 0 ? 'justify-between' : 'justify-center',
              )}
            >
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={goBack}>
                  Back
                </Button>
              ) : null}
              <Button variant={cta.variant} onClick={cta.onClick}>
                {cta.label}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
