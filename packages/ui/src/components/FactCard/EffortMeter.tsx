import { cn } from '../../cn';
import type { FactEffort } from './types';

type Props = {
  readonly effort: FactEffort;
  readonly isPlanned: boolean;
};

const FILLED = 'bg-muted-foreground';
const FILLED_PLANNED = 'bg-faint-foreground';
const EMPTY = 'bg-border';

export const EffortMeter = ({ effort, isPlanned }: Props) => {
  if (effort.steps <= 0) {
    return null;
  }
  const filled = isPlanned ? FILLED_PLANNED : FILLED;
  return (
    <span
      role="img"
      aria-label={`Effort ${effort.word}, ${effort.step} of ${effort.steps}`}
      data-effort-meter=""
      className="inline-flex shrink-0 items-center gap-0.5"
    >
      {Array.from({ length: effort.steps }, (_, index) => (
        <span
          key={index}
          data-segment={index < effort.step ? 'on' : 'off'}
          className={cn('h-1 w-1.5 rounded-full', index < effort.step ? filled : EMPTY)}
        />
      ))}
    </span>
  );
};
