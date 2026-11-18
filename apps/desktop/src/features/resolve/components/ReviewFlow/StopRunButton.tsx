import { Square } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { threadCountText } from '../../reviewLaunchCopy';

const STOP_LOOK = actionButtonLookOf({ verb: 'stop', variant: 'quiet' });

type Props = {
  readonly onStop: () => void;
  readonly label?: string;
  readonly batchSize?: number;
};

const STOP_COPY = {
  label: 'Stop',
  title: 'Stop this fix run?',
  description: 'Comments it has not finished stay open and can be fixed again.',
} as const;

type BatchParams = {
  readonly batchSize: number;
};

const batchStopText = ({ batchSize }: BatchParams): string =>
  `Stop the fix for ${threadCountText({ count: batchSize })}`;

export const StopRunButton = ({ onStop, label = STOP_COPY.label, batchSize = 1 }: Props) => {
  const isBatch = batchSize > 1;
  return (
    <ConfirmPopover
      role="danger"
      icon={<Square size={ICON_SIZE.row} aria-hidden />}
      title={isBatch ? `${batchStopText({ batchSize })}?` : STOP_COPY.title}
      description={STOP_COPY.description}
      confirmLabel={STOP_COPY.label}
      onConfirm={onStop}
      trigger={({ isArmed, arm }) => {
        const button = (
          <Button
            size="xs"
            variant={STOP_LOOK.variant}
            intent={STOP_LOOK.intent}
            aria-expanded={isArmed}
            aria-haspopup="dialog"
            onClick={arm}
          >
            {label}
          </Button>
        );
        return isBatch ? (
          <Tooltip content={batchStopText({ batchSize })}>{button}</Tooltip>
        ) : (
          button
        );
      }}
    />
  );
};
