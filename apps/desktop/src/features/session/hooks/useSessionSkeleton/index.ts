import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useIsSessionSyncing } from '../useIsSessionSyncing';

const SKELETON_DELAY_MS = 250;

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionSkeleton = ({ sessionId }: Params): boolean => {
  const isSyncing = useIsSessionSyncing({ sessionId });
  const [lateSessionId, setLateSessionId] = useState<SessionId | null>(null);

  useEffect(() => {
    if (!isSyncing) {
      setLateSessionId(null);
      return;
    }
    const timer = setTimeout(() => setLateSessionId(sessionId), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isSyncing, sessionId]);

  return isSyncing && lateSessionId === sessionId;
};
