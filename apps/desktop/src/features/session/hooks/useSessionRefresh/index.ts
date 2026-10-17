import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { refreshSession } from '../../refreshSession';

type RefreshParams = {
  readonly sessionId: SessionId;
};

export const useSessionRefresh = (): ((params: RefreshParams) => Promise<void>) => {
  const resyncSession = useAppStore((s) => s.resyncSession);
  const reportError = useAppStore((s) => s.reportError);

  return useCallback(
    ({ sessionId }: RefreshParams): Promise<void> =>
      refreshSession({ sessionId, resyncSession, reportError }),
    [reportError, resyncSession],
  );
};
