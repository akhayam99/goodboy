import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../store';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';

type Params = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind;
  readonly onOpened?: () => void;
};

export const useOpenSession = (): ((params: Params) => void) => {
  const navigate = useAppStore((s) => s.navigate);
  return useCallback(
    ({ sessionId, lens, onOpened }: Params) => {
      navigate({
        to: lensPlace({ state: useAppStore.getState(), sessionId, lens: lens ?? null }),
      });
      onOpened?.();
    },
    [navigate],
  );
};
