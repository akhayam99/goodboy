import { Check, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ONBOARDING_STEPS, dismiss, type OnboardingStepId } from '../onboarding-store';
import { useOnboardingProgress } from '../use-onboarding-progress';

/**
 * GitHub-style progressive checklist. Renders in the EmptyState chat
 * surface as a pinned card top-right. Auto-detects completions from
 * store events (workspace added, first session, first agent, first
 * plan). Skip + Dismiss kill it permanently.
 */
export function OnboardingCard() {
  const progress = useOnboardingProgress();

  if (progress.dismissed) return null;
  if (progress.isDone) return null;

  return (
    <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-2 rounded-xl border border-border-soft bg-elevated/80 p-3 shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
          Goodboy setup
        </span>
        <button
          type="button"
          onClick={() => dismiss()}
          title="dismiss onboarding"
          aria-label="dismiss onboarding"
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
        {progress.completedCount} of {progress.totalCount} steps done.
      </p>
    </div>
  );
}

interface StepRowProps {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
  readonly done: boolean;
}

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

/**
 * Compact 1-line variant — appears in the sidebar footer once the user
 * has at least one session. A whisper, not a stack.
 */
export function OnboardingChip({ onOpen }: { onOpen?: () => void }) {
  const progress = useOnboardingProgress();
  if (progress.dismissed) return null;
  if (progress.isDone) return null;
  if (progress.completedCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      title="onboarding progress"
      className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-subtle/60 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    >
      <span className="inline-flex size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <span>
        {progress.completedCount}/{progress.totalCount} setup
      </span>
    </button>
  );
}
