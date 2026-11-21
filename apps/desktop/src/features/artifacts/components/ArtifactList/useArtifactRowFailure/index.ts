import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import type { ActionSettled } from '../../../../actions/ActionSettled';
import { artifactFailureTitleOf } from '../artifactFailureTitleOf';

type RowFailure = {
  readonly actionId: string;
  readonly error: unknown;
};

type Params = {
  readonly failure: RowFailure | null;
  readonly retry: () => Promise<ActionSettled>;
  readonly dismissFailure: () => void;
  readonly title: string;
  readonly sessionId: SessionId;
};

type ReportParams = {
  readonly title: string;
  readonly error: unknown;
  readonly retry: () => Promise<ActionSettled>;
  readonly sessionId: SessionId;
};

const reportRowFailure = ({ title, error, retry, sessionId }: ReportParams): void => {
  void useAppStore.getState().reportError({
    title,
    error,
    recovery: NOTHING_CHANGED,
    sessionId,
    retry: async () => {
      const settled = await retry();
      if (settled.kind === 'failed') {
        reportRowFailure({ title, error: settled.error, retry, sessionId });
      }
      return settled.kind === 'ok';
    },
  });
};

export const useArtifactRowFailure = ({
  failure,
  retry,
  dismissFailure,
  title,
  sessionId,
}: Params): void => {
  useEffect(() => {
    if (failure === null) {
      return;
    }
    reportRowFailure({
      title: artifactFailureTitleOf({ actionId: failure.actionId, title }),
      error: failure.error,
      retry,
      sessionId,
    });
    dismissFailure();
  }, [failure, retry, dismissFailure, title, sessionId]);
};
