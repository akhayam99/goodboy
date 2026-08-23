import { X } from 'lucide-react';
import { cn, Tooltip } from '@goodboy/ui';
import { finish, ONBOARDING_STEPS, reopen } from '../onboarding-store';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import { ChecklistBody } from './ChecklistBody';
import { CompletedBody } from './CompletedBody';

export const OnboardingCard = () => {
  const progress = useOnboardingProgress();

  if (progress.finished) {
    return null;
  }
  if (!progress.hasProjects) {
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

export const OnboardingChip = () => {
  const progress = useOnboardingProgress();
  if (progress.finished || !progress.hasProjects) {
    return null;
  }

  return (
    <div className="group inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft bg-subtle/60 px-1.5 py-1 motion-safe:transition-colors hover:border-border">
      <button
        type="button"
        onClick={() => reopen()}
        title={`Setup, ${progress.completedCount} of ${progress.totalCount} done`}
        aria-label="Open onboarding checklist"
        className="inline-flex items-center gap-1"
      >
        {ONBOARDING_STEPS.map((step) => (
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
      <Tooltip content="Skip tutorial">
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
      </Tooltip>
    </div>
  );
};
