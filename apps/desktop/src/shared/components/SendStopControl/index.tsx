import { ArrowUp, Square } from 'lucide-react';
import { cn, ICON_SIZE, IconButton, tintClasses } from '@goodboy/ui';
import { NAMES } from '../../utils/names';

type SendStopControlStop = {
  readonly isStopping: boolean;
  readonly onStop: () => void;
};

type Props = {
  readonly canSend: boolean;
  readonly disabledReason?: string;
  readonly stop?: SendStopControlStop;
  readonly onSend: () => void;
};

const SEND_READY = cn(
  tintClasses('primary').solid,
  'hover:bg-primary hover:text-on-tone hover:brightness-110',
);

const SEND_IDLE = 'bg-fill text-faint-foreground hover:bg-fill hover:text-faint-foreground';

const STOP = 'bg-fill text-foreground hover:bg-hover';

export const SendStopControl = ({ canSend, disabledReason, stop, onSend }: Props) => {
  if (stop !== undefined) {
    return (
      <IconButton
        icon={Square}
        iconSize={ICON_SIZE.row}
        label={stop.isStopping ? NAMES.stopping : NAMES.stop}
        tooltip={NAMES.stop}
        busy={stop.isStopping}
        onClick={stop.onStop}
        className={STOP}
      />
    );
  }

  const isReasonShown = !canSend && disabledReason !== undefined;

  return (
    <IconButton
      icon={ArrowUp}
      label={NAMES.send}
      tooltip={isReasonShown ? disabledReason : undefined}
      shortcut={isReasonShown ? undefined : 'composer.send'}
      disabled={!canSend}
      onClick={onSend}
      className={canSend ? SEND_READY : SEND_IDLE}
    />
  );
};
