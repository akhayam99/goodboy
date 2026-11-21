import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import { artifactFailureTitleOf } from '../artifactFailureTitleOf';

type RowFailure = {
  readonly actionId: string;
  readonly error: unknown;
};

type Params = {
  readonly failure: RowFailure | null;
  readonly retry: () => void;
  readonly dismissFailure: () => void;
  readonly title: string;
  readonly sessionId: SessionId;
};

export const useArtifactRowFailure = ({
  failure,
  retry,
  dismissFailure,
  title,
  sessionId,
}: Params): void => {
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (failure === null) {
      return;
    }
    void reportError({
      title: artifactFailureTitleOf({ actionId: failure.actionId, title }),
      error: failure.error,
      recovery: NOTHING_CHANGED,
      sessionId,
      retry: () => {
        retry();
        return Promise.resolve(true);
      },
    });
    dismissFailure();
  }, [failure, retry, dismissFailure, reportError, title, sessionId]);
};
