import { cn, StatusDot, tintClasses } from '@goodboy/ui';
import type { DoorSignal } from './doorSignal';

type Props = {
  readonly signal: DoorSignal;
};

export const DoorSignalMark = ({ signal }: Props) => {
  const tone = signal.tone ?? 'warning';
  if (signal.pill !== undefined) {
    return (
      <span
        aria-hidden
        data-door-signal={tone}
        data-door-pill=""
        className={cn(
          'flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-meta tabular-nums',
          tintClasses(tone === 'danger' ? 'danger' : 'warning').solid,
        )}
      >
        {signal.pill}
      </span>
    );
  }
  if (signal.isWarning) {
    return (
      <span aria-hidden data-door-signal={tone} className="flex shrink-0">
        <StatusDot tone={tone === 'danger' ? 'danger' : 'warning'} size="sm" />
      </span>
    );
  }
  if (signal.tone === 'neutral') {
    return (
      <span aria-hidden data-door-signal="neutral" className="flex shrink-0">
        <StatusDot tone="neutral" size="sm" />
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
  return null;
};
