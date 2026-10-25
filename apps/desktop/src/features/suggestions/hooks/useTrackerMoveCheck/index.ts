import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isSessionShipped } from '../../../../store/slices/tracker-moves/isSessionShipped';
import { trackerTasksOf } from '../../../../store/slices/tracker-moves/trackerTasksOf';

type Params = {
  readonly sessionId: SessionId;
};

export const useTrackerMoveCheck = ({ sessionId }: Params): void => {
  const checkTrackerMoves = useAppStore((state) => state.checkTrackerMoves);
  const signature = useAppStore((state) => {
    const keys = trackerTasksOf({ state, sessionId }).map(
      (task) => `${task.provider}:${task.externalId}`,
    );
    return `${isSessionShipped({ state, sessionId }) ? 'shipped' : 'open'}|${keys.join(',')}`;
  });

  useEffect(() => {
    void checkTrackerMoves({ sessionId });
  }, [checkTrackerMoves, sessionId, signature]);
};
