import { StatusMark } from '@goodboy/ui';
import { doorMarkOf } from './doorMarkOf';
import type { DoorSignal } from './doorSignal';

type Props = {
  readonly signal: DoorSignal;
  readonly isDotOnly?: boolean;
};

export const DoorSignalMark = ({ signal, isDotOnly = false }: Props) => {
  const mark = doorMarkOf({ signal, isDotOnly });
  if (mark.kind === 'empty' || mark.kind === 'state') {
    return null;
  }
  return (
    <span
      aria-hidden
      data-door-signal={mark.tone}
      data-door-count={mark.kind === 'count' ? '' : undefined}
      className="flex shrink-0"
    >
      <StatusMark mark={mark} />
    </span>
  );
};
