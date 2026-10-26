import { Clock } from 'lucide-react';
import { ICON_SIZE, Tooltip } from '@goodboy/ui';
import type { RunTimeLeft } from '../../session/timeline/runTimeLeft';

type Props = {
  readonly timeLeft: RunTimeLeft;
};

export const RunTimeLeftLabel = ({ timeLeft }: Props) => (
  <Tooltip content={timeLeft.detail}>
    <span
      data-testid="run-time-left"
      className="inline-flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground"
    >
      <Clock size={ICON_SIZE.row} aria-hidden />
      {timeLeft.label}
    </span>
  </Tooltip>
);
