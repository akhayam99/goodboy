import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useIsSessionSyncing } from '../useIsSessionSyncing';

const SKELETON_DELAY_MS = 250;

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionSkeleton = ({ sessionId }: Params): boolean => {
  const isSyncing = useIsSessionSyncing({ sessionId });
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (!isSyncing) {
      setIsLate(false);
      return;
    }
    const timer = setTimeout(() => setIsLate(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isSyncing]);

  return isSyncing && isLate;
};
