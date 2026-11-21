import { Button, Tooltip } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { threadCountText } from '../../reviewLaunchCopy';

const STOP_LOOK = actionButtonLookOf({ verb: 'stop', variant: 'quiet' });

type Props = {
  readonly onStop: () => void;
  readonly label?: string;
  readonly batchSize?: number;
};

const STOP_LABEL = 'Stop';

type BatchParams = {
  readonly batchSize: number;
};

const batchStopText = ({ batchSize }: BatchParams): string =>
  `Stop fixing ${threadCountText({ count: batchSize })}`;

export const StopRunButton = ({ onStop, label = STOP_LABEL, batchSize = 1 }: Props) => {
  const button = (
    <Button size="xs" variant={STOP_LOOK.variant} intent={STOP_LOOK.intent} onClick={onStop}>
      {label}
    </Button>
  );
  return batchSize > 1 ? (
    <Tooltip content={batchStopText({ batchSize })}>{button}</Tooltip>
  ) : (
    button
  );
};
