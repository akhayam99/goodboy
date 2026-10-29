import { StatusDot } from '@goodboy/ui';
import { TONE_COUNT_CLASS } from '../../../shared/components/toneCountClass';
import type { DoorSignal } from './doorSignal';

type Props = {
  readonly signal: DoorSignal;
  readonly isDotOnly?: boolean;
};

export const DoorSignalMark = ({ signal, isDotOnly = false }: Props) => {
  const tone = signal.tone ?? 'warning';
  if (signal.countText !== undefined && !isDotOnly) {
    return (
      <span aria-hidden data-door-signal={tone} data-door-count="" className={TONE_COUNT_CLASS}>
        <StatusDot tone={tone === 'danger' ? 'danger' : 'warning'} size="sm" />
        <span>{signal.countText}</span>
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
