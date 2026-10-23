import { cn } from '@goodboy/ui';
import type { HintTally } from './hints/hintTally';

type Props = {
  readonly tally: HintTally;
};

export const DemoHintDots = ({ tally }: Props) => (
  <span aria-hidden className="flex items-center gap-1">
    {Array.from({ length: tally.total }, (_, index) => (
      <span
        key={index}
        className={cn(
          'size-1.5 rounded-full motion-safe:transition-colors',
          index < tally.tried ? 'bg-primary' : 'bg-fill',
        )}
      />
    ))}
  </span>
);
