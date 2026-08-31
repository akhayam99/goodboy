import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind;
  readonly onOpened?: () => void;
};

export const useOpenSession = (): ((params: Params) => Promise<void>) => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  return useCallback(
    async ({ sessionId, lens, onOpened }: Params) => {
      try {
        await setCurrentSession(sessionId);
      } catch {
        return;
      }
      if (lens !== undefined) {
        setActiveLens(sessionId, lens);
      }
      onOpened?.();
    },
    [setActiveLens, setCurrentSession],
  );
};
