import { FOCUS_RING, cn } from '@goodboy/ui';
import type { DemoBeat } from './demoChapters';
import { useBeatFill } from './useBeatFill';

type Props = {
  readonly beat: DemoBeat;
  readonly state: 'past' | 'current' | 'next';
  readonly isRunning: boolean;
  readonly isPending: boolean;
  readonly runKey: string;
  readonly onSelect: () => void;
};

export const DemoBeatSegment = ({ beat, state, isRunning, isPending, runKey, onSelect }: Props) => {
  const fillRef = useBeatFill({ isRunning, durationMs: beat.holdMs, runKey });
  const isCurrent = state === 'current';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isCurrent ? 'step' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2 rounded-md px-2 py-2 text-left motion-safe:transition-colors hover:bg-hover',
        FOCUS_RING,
      )}
    >
      <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-fill">
        <span
          ref={fillRef}
          className={cn(
            'absolute inset-0 origin-left rounded-full',
            isCurrent ? 'bg-primary' : 'bg-muted-foreground',
          )}
          style={{ transform: state === 'next' || isPending ? 'scaleX(0)' : 'scaleX(1)' }}
        />
      </span>
      <span
        className={cn(
          'truncate text-label',
          isCurrent ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {beat.label}
      </span>
    </button>
  );
};
