import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';

type Params = {
  readonly sessionId: SessionId;
  readonly onError?: (message: string) => void;
};

type Result = {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly run: () => Promise<void>;
};

export const usePushBranch = ({ sessionId, onError }: Params): Result => {
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (message: string) => {
    setError(message);
    onError?.(message);
  };

  const run = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const result = await pushSessionBranch(sessionId);
      if (!result.ok) {
        fail(result.error);
      }
    } catch (failure) {
      fail(formatError(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return { isBusy, error, run };
};
