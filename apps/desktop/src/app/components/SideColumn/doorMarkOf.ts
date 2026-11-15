import type { StatusMarkSpec } from '@goodboy/ui';
import type { DoorSignal } from './doorSignal';

type Params = {
  readonly signal: DoorSignal | undefined;
  readonly isDotOnly?: boolean;
};

const EMPTY: StatusMarkSpec = { kind: 'empty' };

export const doorMarkOf = ({ signal, isDotOnly = false }: Params): StatusMarkSpec => {
  if (signal === undefined) {
    return EMPTY;
  }
  const warningTone = signal.tone === 'danger' ? 'danger' : 'warning';
  if (signal.countText !== undefined && !isDotOnly) {
    return {
      kind: 'count',
      tone: signal.isWarning ? warningTone : 'neutral',
      text: signal.countText,
    };
  }
  if (signal.isWarning) {
    return { kind: 'dot', tone: warningTone };
  }
  if (signal.tone === 'neutral') {
    return { kind: 'dot', tone: 'neutral' };
  }
  if (signal.isUnread) {
    return { kind: 'dot', tone: 'unread' };
  }
  return EMPTY;
};
