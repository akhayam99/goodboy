import { useEffect, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { touchedMountIdsOf, type TouchedMountIds } from '../../touchedMountIdsOf';

type Params = {
  readonly sessionId: SessionId;
};

export const useTouchedMountIds = ({ sessionId }: Params): TouchedMountIds => {
  const spans = useAppStore((state) => state.sessionTurnSpans?.[sessionId]);
  const loadSessionTurnSpans = useAppStore((state) => state.loadSessionTurnSpans);
  const isLoaded = spans !== undefined;
  useEffect(() => {
    if (!isLoaded) {
      void loadSessionTurnSpans?.({ sessionId });
    }
  }, [isLoaded, loadSessionTurnSpans, sessionId]);
  return useMemo(() => touchedMountIdsOf({ spans }), [spans]);
};
