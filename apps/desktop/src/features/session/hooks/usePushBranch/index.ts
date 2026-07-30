import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';

type Params = {
  readonly sessionId: SessionId;
};

type Result = {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly run: () => Promise<void>;
};

export const usePushBranch = ({ sessionId }: Params): Result => {
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const result = await pushSessionBranch(sessionId);
      if (!result.ok) {
        setError(result.error);
      }
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return { isBusy, error, run };
};
