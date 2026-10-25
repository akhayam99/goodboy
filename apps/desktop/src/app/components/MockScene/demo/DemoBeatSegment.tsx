import { FOCUS_RING, cn } from '@goodboy/ui';
import type { DemoBeat } from './demoChapters';
import type { BeatFill } from './useBeatPlayer';
import { useBeatFill } from './useBeatFill';

type Props = {
  readonly beat: DemoBeat;
  readonly state: 'past' | 'current' | 'next';
  readonly isRunning: boolean;
  readonly isComplete: boolean;
  readonly fill: BeatFill;
  readonly runKey: string;
  readonly onSelect: () => void;
};

type RestParams = {
  readonly state: Props['state'];
  readonly isComplete: boolean;
  readonly fill: BeatFill;
};

const restScale = ({ state, isComplete, fill }: RestParams): number => {
  if (state === 'past' || isComplete) {
    return 1;
  }
  if (state === 'next' || fill.totalMs <= 0) {
    return 0;
  }
  return Math.min(1, fill.startMs / fill.totalMs);
};

export const DemoBeatSegment = ({
  beat,
  state,
  isRunning,
  isComplete,
  fill,
  runKey,
  onSelect,
}: Props) => {
  const fillRef = useBeatFill({
    isRunning,
    totalMs: fill.totalMs,
    startMs: fill.startMs,
    runKey,
  });
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
          style={{ transform: `scaleX(${restScale({ state, isComplete, fill })})` }}
        />
      </span>
      <span
        className={cn(
          'truncate text-meta',
          isCurrent ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {beat.label}
      </span>
    </button>
  );
};
