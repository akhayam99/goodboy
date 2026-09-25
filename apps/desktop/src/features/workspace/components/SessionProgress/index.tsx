import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { WorkflowProgress } from '../../hooks/useSessionSummary/workflowProgress';

type Props = {
  readonly progress: WorkflowProgress;
  readonly tone: Tone;
  readonly className?: string;
};

const MAX_SEGMENTS = 12;

export const SessionProgress = ({ progress, tone, className }: Props) => {
  const { label, current, total } = progress;
  const segments = Math.min(total, MAX_SEGMENTS);
  const filled = total <= MAX_SEGMENTS ? current : Math.round((current / total) * MAX_SEGMENTS);
  const count = `${current} of ${total}`;
  return (
    <span
      data-testid="session-progress"
      className={cn('flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground', className)}
    >
      <span role="img" aria-label={`Step ${count}`} className="flex shrink-0 items-center gap-0.5">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 w-2 rounded-full',
              index < filled ? tintClasses(tone).dot : 'bg-fill',
            )}
          />
        ))}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden className="shrink-0 tabular-nums text-faint-foreground">
        · {count}
      </span>
    </span>
  );
};
