import { Check, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import {
  visibleOnboardingSteps,
  collapse,
  finish,
  reopen,
  type OnboardingGroup,
  type OnboardingStepId,
} from '../onboarding-store';
import { useOnboardingProgress, type OnboardingProgress } from '../hooks/useOnboardingProgress';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

const GROUP_LABEL: Record<OnboardingGroup, string> = {
  setup: 'Setup',
  build: 'First steps',
};

const GROUP_ORDER: ReadonlyArray<OnboardingGroup> = ['setup', 'build'];

export const OnboardingCard = () => {
  const progress = useOnboardingProgress();

  if (progress.finished) {
    return null;
  }
  if (!progress.isDone && progress.collapsed) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20">
      <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-2 rounded-[6px] border border-border-soft bg-elevated/80 p-3 shadow-md backdrop-blur-sm">
        {progress.isDone ? <CompletedBody /> : <ChecklistBody progress={progress} />}
      </div>
    </div>
  );
};

function ChecklistBody({ progress }: { progress: OnboardingProgress }) {
  const visibleSteps = visibleOnboardingSteps({ isSimple: progress.isSimple });
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy setup</span>
        <button
          type="button"
          onClick={() => collapse()}
          title="Hide onboarding checklist (reopen it from the top bar)"
          aria-label="Hide onboarding checklist"
          className="rounded-md p-0.5 text-muted-foreground/70 motion-safe:transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={11} aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {GROUP_ORDER.map((group) => {
          const steps = visibleSteps.filter((s) => s.group === group);
          if (steps.length === 0) {
            return null;
          }
          return (
            <div key={group} className="flex flex-col gap-1">
              <span className="px-1.5 text-3xs font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
                {GROUP_LABEL[group]}
              </span>
              <ul className="flex flex-col gap-1">
                {steps.map((step) => (
                  <StepRow
                    key={step.id}
                    id={step.id}
                    title={step.title}
                    why={step.why}
                    done={progress.completed.has(step.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-3xs leading-snug text-muted-foreground/60">
        {progress.completedCount} of {progress.totalCount} steps done
      </p>
    </>
  );
}

function CompletedBody() {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-success">
          <CONCEPT_ICONS.decisions size={11} aria-hidden />
          Setup complete
        </span>
        <button
          type="button"
          onClick={() => finish()}
          title="Dismiss onboarding"
          aria-label="Dismiss onboarding"
          className="rounded-md p-0.5 text-muted-foreground/70 motion-safe:transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={11} aria-hidden />
        </button>
      </div>
      <p className="text-2xs leading-snug text-muted-foreground/80">
        That was the last step. Setup is complete.
      </p>
    </>
  );
}

type StepRowProps = {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
  readonly done: boolean;
};

function StepRow({ title, why, done }: StepRowProps) {
  return (
    <li
      title={why}
      className={cn(
        'flex items-center gap-2 rounded-md px-1.5 py-1 text-2xs motion-safe:transition-colors',
        done ? 'text-muted-foreground/60' : 'text-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success/15 text-success' : 'border-border-soft bg-transparent',
        )}
      >
        {done ? <Check size={9} aria-hidden /> : null}
      </span>
      <span className={cn('truncate', done && 'line-through decoration-1')}>{title}</span>
    </li>
  );
}

export const OnboardingChip = () => {
  const progress = useOnboardingProgress();
  if (progress.finished) {
    return null;
  }

  const visibleSteps = visibleOnboardingSteps({ isSimple: progress.isSimple });

  return (
    <div className="group inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft bg-subtle/60 px-1.5 py-1 motion-safe:transition-colors hover:border-border">
      <button
        type="button"
        onClick={() => reopen()}
        title={`Setup, ${progress.completedCount} of ${progress.totalCount} done`}
        aria-label="Open onboarding checklist"
        className="inline-flex items-center gap-1"
      >
        {visibleSteps.map((step) => (
          <span
            key={step.id}
            aria-hidden
            className={cn(
              'size-1.5 rounded-full motion-safe:transition-colors',
              progress.completed.has(step.id) ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </button>
      <button
        type="button"
        aria-label="Skip tutorial"
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
        className="flex items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={10} aria-hidden />
      </button>
    </div>
  );
};
