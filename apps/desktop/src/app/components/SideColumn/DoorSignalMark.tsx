import { StatusDot } from '@goodboy/ui';
import type { DoorSignal } from './doorSignal';

type Props = {
  readonly signal: DoorSignal;
};

export const DoorSignalMark = ({ signal }: Props) => {
  if (signal.isWarning) {
    return (
      <span aria-hidden data-door-signal="warning" className="flex shrink-0">
        <StatusDot tone="warning" size="sm" />
      </span>
    );
  }
  if (signal.isUnread) {
    return (
      <span aria-hidden data-door-signal="unread" className="flex shrink-0">
        <StatusDot tone="primary" size="sm" />
      </span>
    );
  }
  return (
    <span aria-hidden data-door-signal="dot" className="flex shrink-0">
      <StatusDot tone="info" size="sm" />
    </span>
  );
};
