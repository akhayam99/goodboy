import { useEffect } from 'react';
import { Button, StatusDot, TruncatedText, type Tone } from '@goodboy/ui';
import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';
import { NAMES } from '../../../shared/utils/names';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';
import { trainLineOf } from './trainLineOf';

type Props = {
  readonly train: MergeTrain;
  readonly onStop: () => void;
  readonly onDismiss: () => void;
};

type ToneParams = {
  readonly train: MergeTrain;
};

const trainToneOf = ({ train }: ToneParams): Tone => {
  if (train.outcome === null) {
    return 'info';
  }
  return train.outcome.kind === 'stopped' ? 'warning' : 'success';
};

const SETTLED_MS = 3_000;
const DISMISS = 'Dismiss';

export const TrainStrip = ({ train, onStop, onDismiss }: Props) => {
  const { outcome } = train;
  const isLive = outcome === null;
  const isStopped = outcome !== null && outcome.kind === 'stopped';
  useEffect(() => {
    if (outcome === null || outcome.kind === 'stopped') {
      return undefined;
    }
    const timer = setTimeout(onDismiss, SETTLED_MS);
    return () => clearTimeout(timer);
  }, [outcome, onDismiss]);
  const stop = actionButtonLookOf({ verb: NAMES.stopAfterThisOne, variant: 'quiet' });
  const dismiss = actionButtonLookOf({ verb: DISMISS, variant: 'quiet' });
  return (
    <div
      data-merge-train=""
      data-train-live={isLive ? '' : undefined}
      role="status"
      className="flex min-h-8 min-w-0 items-center gap-2"
    >
      <StatusDot tone={trainToneOf({ train })} size="sm" pulsing={isLive} />
      <TruncatedText className="min-w-0 flex-1 text-ui text-foreground">
        {trainLineOf({ train })}
      </TruncatedText>
      {isLive ? (
        <Button
          size="xs"
          variant={stop.variant}
          intent={stop.intent}
          disabled={train.isStopRequested}
          onClick={onStop}
        >
          {NAMES.stopAfterThisOne}
        </Button>
      ) : null}
      {isStopped ? (
        <Button size="xs" variant={dismiss.variant} intent={dismiss.intent} onClick={onDismiss}>
          {DISMISS}
        </Button>
      ) : null}
    </div>
  );
};
