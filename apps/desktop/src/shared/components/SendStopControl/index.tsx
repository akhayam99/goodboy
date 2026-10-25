import { ArrowUp, Square } from 'lucide-react';
import { Button, cn, ICON_SIZE, IconButton, tintClasses } from '@goodboy/ui';
import { NAMES } from '../../utils/names';

type SendStopControlStop = {
  readonly isStopping: boolean;
  readonly onStop: () => void;
  readonly isStalled?: boolean;
  readonly isArmed?: boolean;
  readonly shortcut?: string;
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
    if (stop.isStalled === true) {
      return (
        <Button variant="danger" size="sm" onClick={stop.onStop}>
          {NAMES.forceStop}
        </Button>
      );
    }

    return (
      <>
        {stop.isArmed === true ? (
          <span role="status" className="whitespace-nowrap text-meta text-muted-foreground">
            Esc again to stop
          </span>
        ) : null}
        <IconButton
          icon={Square}
          iconSize={ICON_SIZE.row}
          label={stop.isStopping ? NAMES.stopping : NAMES.stop}
          tooltip={NAMES.stop}
          shortcut={stop.shortcut}
          busy={stop.isStopping}
          onClick={stop.onStop}
          className={STOP}
        />
      </>
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
