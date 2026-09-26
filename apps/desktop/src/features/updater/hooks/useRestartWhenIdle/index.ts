import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { useRunningAgentCount } from '../useRunningAgentCount';

export const useRestartWhenIdle = (): void => {
  const isQueued = useAppStore((state) => state.updateQueuedUntilIdle);
  const applyUpdate = useAppStore((state) => state.applyUpdate);
  const setUpdateQueuedUntilIdle = useAppStore((state) => state.setUpdateQueuedUntilIdle);
  const runningCount = useRunningAgentCount();

  useEffect(() => {
    if (!isQueued || runningCount !== 0) {
      return;
    }
    setUpdateQueuedUntilIdle({ queued: false });
    void applyUpdate();
  }, [isQueued, runningCount, applyUpdate, setUpdateQueuedUntilIdle]);
};
