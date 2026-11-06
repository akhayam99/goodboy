import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useToast } from '../../../../../../shared/components/Toast';
import { NAMES } from '../../../../../../shared/utils/names';
import { useAppStore } from '../../../../../../store';
import { liveAgentsOf } from '../../../../../../store/runtime/live-work/liveAgentsOf';
import { stopAllMessageOf } from '../../../../stopAllMessageOf';
import { stopAllRunningAgents } from '../../../../stopAllRunningAgents';

type Props = {
  readonly sessionId: SessionId;
};

const STOP_ALL_FLOOR = 2;

export const StopAllAction = ({ sessionId }: Props) => {
  const runningCount = useAppStore((state) => liveAgentsOf({ state, sessionId }).length);
  const { showToast } = useToast();
  const [isStopping, setIsStopping] = useState(false);

  const stopAll = async () => {
    if (isStopping) {
      return;
    }
    setIsStopping(true);
    try {
      const result = await stopAllRunningAgents({
        getState: useAppStore.getState,
        sessionId,
      });
      showToast({ kind: 'info', message: stopAllMessageOf({ result }) });
    } finally {
      setIsStopping(false);
    }
  };

  if (runningCount < STOP_ALL_FLOOR) {
    return null;
  }
  return (
    <Button variant="quiet" size="xs" isBusy={isStopping} onClick={() => void stopAll()}>
      {NAMES.stopAll} ({runningCount})
    </Button>
  );
};
