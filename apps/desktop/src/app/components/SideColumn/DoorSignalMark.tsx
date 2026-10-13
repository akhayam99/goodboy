import { StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { DoorSignal } from './doorSignal';

type Props = {
  readonly signal: DoorSignal;
};

export const DoorSignalMark = ({ signal }: Props) => {
  if (signal.isWarning) {
    return (
      <span aria-hidden data-door-signal="warning" className="flex shrink-0">
        <StatusDot tone="warning" size="md" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-door-signal="count"
      className={cn('shrink-0 text-meta tabular-nums', tintClasses('info').text)}
    >
      {signal.count}
    </span>
  );
};
