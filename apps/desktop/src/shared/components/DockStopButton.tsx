import { Button } from '@goodboy/ui';
import type { ConversationStop } from '../types/conversationStop';
import { NAMES } from '../utils/names';

type Props = {
  readonly stop: ConversationStop;
};

export const DockStopButton = ({ stop }: Props) => {
  if (stop.phase === 'stalled') {
    return (
      <Button variant="danger" size="xs" onClick={stop.stop}>
        {NAMES.forceStop}
      </Button>
    );
  }
  return (
    <Button
      variant="quiet"
      size="xs"
      isBusy={stop.phase === 'stopping'}
      busyLabel={NAMES.stopping}
      onClick={stop.stop}
    >
      {stop.label}
    </Button>
  );
};
