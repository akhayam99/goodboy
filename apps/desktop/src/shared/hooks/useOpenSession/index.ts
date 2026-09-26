import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind, sessionPlace } from '../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind;
  readonly onOpened?: () => void;
};

export const useOpenSession = (): ((params: Params) => void) => {
  const navigate = useAppStore((s) => s.navigate);
  return useCallback(
    ({ sessionId, lens, onOpened }: Params) => {
      navigate({ to: sessionPlace({ sessionId, lens: lens ?? null }) });
      onOpened?.();
    },
    [navigate],
  );
};
