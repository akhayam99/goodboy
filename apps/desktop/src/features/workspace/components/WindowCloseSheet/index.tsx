import { useEffect, useState } from 'react';
import { Button, Dialog, FormActions } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { endedWaitingRunsOf } from '../../../../store/runtime/live-work/endedWaitingRunsOf';
import { liveAgentCountOf } from '../../../../store/runtime/live-work/liveAgentCountOf';
import { stopWork } from '../../../../store/runtime/live-work/stopWork';
import { currentPlatform } from '../../../../shared/platform';
import { NAMES } from '../../../../shared/utils/names';
import { closeWindowNow, isMainWindow } from '../../window';
import { setWindowCloseGuard } from '../../windowCloseGuard';
import { windowCloseCopyOf } from './windowCloseCopyOf';

type Ask = Readonly<{
  count: number;
  isStuck: boolean;
}>;

type Props = {
  readonly initialAsk?: Ask | null;
};

export const WindowCloseSheet = ({ initialAsk = null }: Props) => {
  const [ask, setAsk] = useState<Ask | null>(initialAsk);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(
    () =>
      setWindowCloseGuard({
        guard: async () => {
          if (isMainWindow() && currentPlatform() === 'darwin') {
            return 'hide';
          }
          const keptRuns = await endedWaitingRunsOf({ state: useAppStore.getState() });
          const count = liveAgentCountOf({ state: useAppStore.getState(), keptRuns });
          if (count === 0) {
            return 'close';
          }
          setAsk({ count, isStuck: false });
          return 'hold';
        },
      }),
    [],
  );

  if (ask === null) {
    return null;
  }

  const copy = windowCloseCopyOf({ count: ask.count, isStuck: ask.isStuck });

  const stopAndClose = async () => {
    if (ask.isStuck) {
      await closeWindowNow();
      return;
    }
    setIsStopping(true);
    try {
      const { stillRunning } = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'all' },
        reason: 'leave',
      });
      if (stillRunning > 0) {
        setAsk({ count: stillRunning, isStuck: true });
        return;
      }
      await closeWindowNow();
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => setAsk(null)}
      title={copy.title}
      description={copy.description}
      size="sm"
      showClose={false}
      headerBordered={false}
    >
      <FormActions>
        <Button variant="quiet" size="sm" onClick={() => setAsk(null)} disabled={isStopping}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          isBusy={isStopping}
          busyLabel={NAMES.stopping}
          onClick={() => void stopAndClose()}
        >
          {copy.confirmLabel}
        </Button>
      </FormActions>
    </Dialog>
  );
};
