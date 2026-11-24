import { Button, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';
import { mergeHintOf } from './mergeHintOf';
import { mergeLabelOf } from './mergeLabelOf';
import { TrainStrip } from './TrainStrip';
import { useMergeTrain } from './useMergeTrain';
import { useReadyToMerge } from './useReadyToMerge';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
};

export const MergeInOrder = ({ sessions }: Props) => {
  const { ready, sessionTitles } = useReadyToMerge({ sessions });
  const train = useMergeTrain({ ready, sessionTitles });
  if (train.train !== null) {
    return <TrainStrip train={train.train} onStop={train.stop} onDismiss={train.dismiss} />;
  }
  if (train.cars.length === 0) {
    return null;
  }
  const label = mergeLabelOf({ count: train.cars.length });
  const look = actionButtonLookOf({ verb: label, variant: 'secondary' });
  return (
    <Tooltip content={mergeHintOf({ method: train.method })}>
      <Button
        size="xs"
        variant={look.variant}
        intent={look.intent}
        data-merge-in-order=""
        onClick={train.start}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
