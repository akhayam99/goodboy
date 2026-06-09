import { Check, Sparkles, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import {
  ONBOARDING_STEPS,
  collapse,
  finish,
  reopen,
  type OnboardingStepId,
} from '../onboarding-store';
import { useOnboardingProgress, type OnboardingProgress } from '../hooks/useOnboardingProgress';

export const OnboardingCard = () => {
  const progress = useOnboardingProgress();

  if (progress.finished) return null;
  if (!progress.isDone && progress.collapsed) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-14 z-20">
      <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-2 rounded-[6px] border border-border-soft bg-elevated/80 p-3 shadow-md backdrop-blur-sm">
        {progress.isDone ? <CompletedBody /> : <ChecklistBody progress={progress} />}
      </div>
    </div>
  );
};

function ChecklistBody({ progress }: { progress: OnboardingProgress }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
          Goodboy setup
        </span>
        <button
          type="button"
          onClick={() => collapse()}
          title="hide, reopen from the sidebar"
          aria-label="hide onboarding checklist"
          className="rounded-sm p-0.5 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={11} aria-hidden />
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {ONBOARDING_STEPS.map((step) => (
          <StepRow
            key={step.id}
            id={step.id}
            title={step.title}
            why={step.why}
            done={progress.completed.has(step.id)}
          />
        ))}
      </ul>
      <p className="text-[10px] leading-snug text-muted-foreground/60">
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
          <Sparkles size={11} aria-hidden />
          Setup complete
        </span>
        <button
          type="button"
          onClick={() => finish()}
          title="dismiss"
          aria-label="dismiss onboarding"
          className="rounded-sm p-0.5 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={11} aria-hidden />
        </button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground/80">
        Nice, you've got the hang of Goodboy. That was the last step.
      </p>
      <button
        type="button"
        onClick={() => finish()}
        className="self-start rounded-md bg-primary px-2 py-1 text-2xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
      >
        Done
      </button>
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
        'flex items-center gap-2 rounded-md px-1.5 py-1 text-2xs transition-colors',
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
  if (progress.finished) return null;

  return (
    <button
      type="button"
      onClick={() => reopen()}
      title={`Setup, ${progress.completedCount} of ${progress.totalCount} done`}
      aria-label="open onboarding checklist"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft bg-subtle/60 px-1.5 py-1 transition-colors hover:border-border"
    >
      {ONBOARDING_STEPS.map((step, i) => (
        <span
          key={step.id}
          aria-hidden
          className={cn(
            'size-1.5 rounded-full transition-colors',
            i < progress.completedCount ? 'bg-primary' : 'bg-border',
          )}
        />
      ))}
    </button>
  );
};
