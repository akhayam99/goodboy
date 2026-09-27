import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

export const REFRESH_FAILED_TITLE = "Couldn't refresh this session";

type RefreshParams = {
  readonly sessionId: SessionId;
};

export const useSessionRefresh = (): ((params: RefreshParams) => Promise<void>) => {
  const resyncSession = useAppStore((s) => s.resyncSession);
  const reportError = useAppStore((s) => s.reportError);

  return useCallback(
    async ({ sessionId }: RefreshParams): Promise<void> => {
      try {
        await resyncSession({ sessionId });
      } catch (error) {
        await reportError({ title: REFRESH_FAILED_TITLE, error, sessionId });
      }
    },
    [reportError, resyncSession],
  );
};
