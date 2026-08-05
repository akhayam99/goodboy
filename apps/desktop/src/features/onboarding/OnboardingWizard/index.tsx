import { useEffect, useRef, useState } from 'react';
import { Button, ScrollFade, cn, type ButtonVariant } from '@goodboy/ui';
import { finishWizard } from '../onboarding-store';
import { useOnboardingWizard } from './useOnboardingWizard';
import { Stepper } from './Stepper';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { WorkspaceStep, type WorkspaceAudience } from './steps/WorkspaceStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { CodeHostStep } from './steps/CodeHostStep';
import { TrackerStep } from './steps/TrackerStep';
import { SentryStep } from './steps/SentryStep';
import { ReadyStep } from './steps/ReadyStep';

const STEP_COUNT = 8;
const SETUP_START_STEP = 3;
const EXIT_MS = 200;
const ALL_STEPS = Array.from({ length: STEP_COUNT }, (_, index) => index);
const SIMPLE_STEPS = [0, 1, 2, 3, 5, 7];
const STEP_LABELS = {
  4: 'Code host',
  6: 'Sentry',
} as const;

const joinStepLabels = ({ labels }: { readonly labels: ReadonlyArray<string> }): string => {
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    const first = labels[0];
    if (first === undefined) {
      return '';
    }
    return first;
  }
  if (labels.length === 2) {
    const first = labels[0];
    const second = labels[1];
    if (first === undefined || second === undefined) {
      return '';
    }
    return `${first} and ${second}`;
  }
  const head = labels.slice(0, -1).join(', ');
  const tail = labels[labels.length - 1];
  if (tail === undefined) {
    return head;
  }
  return `${head}, and ${tail}`;
};

const buildStepRemovalNotice = ({
  removed,
}: {
  readonly removed: ReadonlyArray<number>;
}): string | null => {
  const labels: string[] = [];
  for (const candidate of removed) {
    if (candidate === 4) {
      labels.push(STEP_LABELS[4]);
    }
    if (candidate === 6) {
      labels.push(STEP_LABELS[6]);
    }
  }
  if (labels.length === 0) {
    return null;
  }
  return `${joinStepLabels({ labels })} ${labels.length === 1 ? 'is' : 'are'} skipped for standalone workspaces.`;
};

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
    workspace,
    workspaceId,
    workspaceKind,
    githubConnected,
    gitlabConnected,
    hasCodeHost,
    hasLinear,
    hasJira,
    hasSentry,
    refreshGithubStatus,
  } = useOnboardingWizard();
  const [step, setStep] = useState(0);
  const [workspaceAudience, setWorkspaceAudience] = useState<WorkspaceAudience | null>(null);
  const [changingWorkspace, setChangingWorkspace] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stepRemovalNotice, setStepRemovalNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSimple = workspaceKind === 'simple';
  const availableSteps = isSimple ? SIMPLE_STEPS : ALL_STEPS;
  const steps = availableSteps.filter((candidate) =>
    mode === 'setup' ? candidate >= SETUP_START_STEP : true,
  );
  const minStep = steps[0] ?? 0;
  const last = STEP_COUNT - 1;
  const previousStepsRef = useRef<ReadonlyArray<number>>(steps);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(minStep);
    setClosing(false);
    setStepRemovalNotice(null);
    previousStepsRef.current = steps;
    containerRef.current?.focus();
  }, [open, minStep]);

  useEffect(() => {
    if (!open) {
      previousStepsRef.current = steps;
      return;
    }
    const previousSteps = previousStepsRef.current;
    previousStepsRef.current = steps;
    const removed = previousSteps.filter((candidate) => !steps.includes(candidate));
    const notice = buildStepRemovalNotice({ removed });
    if (notice !== null) {
      setStepRemovalNotice(notice);
    }
    if (steps.includes(step)) {
      return;
    }
    const nextStep = steps.find((candidate) => candidate > step);
    if (nextStep !== undefined) {
      setStep(nextStep);
      return;
    }
    const fallbackStep = [...steps].reverse().find((candidate) => candidate < step);
    setStep(fallbackStep ?? minStep);
  }, [open, steps, step, minStep]);

  if (!open) {
    return null;
  }

  const goNext = () =>
    setStep((current) => {
      const index = steps.indexOf(current);
      return steps[index + 1] ?? last;
    });
  const goBack = () =>
    setStep((current) => {
      const index = steps.indexOf(current);
      return steps[index - 1] ?? minStep;
    });
  const canSkipSetup = hasWorkspace;
  const stepOwnsActions =
    step === 2 && (workspace === null ? workspaceAudience !== null : changingWorkspace);
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
    body = (
      <WorkspaceStep
        workspace={workspace}
        audience={workspaceAudience}
        onAudienceChange={setWorkspaceAudience}
        isChanging={changingWorkspace}
        onIsChangingChange={setChangingWorkspace}
      />
    );
    cta = { label: 'Continue', onClick: goNext, variant: 'primary', disabled: !hasWorkspace };
  } else if (step === 3) {
    body = <PreferencesStep workspaceId={workspaceId} workspaceKind={workspaceKind} />;
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
    body = (
      <TrackerStep workspaceId={workspaceId} linearConnected={hasLinear} jiraConnected={hasJira} />
    );
    cta =
      hasLinear || hasJira
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
          {step > minStep && (
            <Stepper current={steps.indexOf(step)} total={Math.max(steps.length - 1, 0)} />
          )}
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

      <ScrollFade className="min-h-0 flex-1">
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-xl flex-col gap-8">
            {stepRemovalNotice !== null ? (
              <p role="status" className="text-center text-xs text-muted-foreground">
                {stepRemovalNotice}
              </p>
            ) : null}
            <div key={step} className="motion-safe:animate-fade-in">
              {body}
            </div>
            {!stepOwnsActions && (
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
            )}
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
