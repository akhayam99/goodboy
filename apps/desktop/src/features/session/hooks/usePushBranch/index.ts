import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Params = {
  readonly sessionId: SessionId;
  readonly onError?: (message: string) => void;
};

type Result = {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly run: () => Promise<void>;
};

const PUSH_PROGRESS_LABEL = 'Pushing the branch';

export const usePushBranch = ({ sessionId, onError }: Params): Result => {
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const beginSessionCreation = useAppStore((state) => state.beginSessionCreation);
  const endSessionCreation = useAppStore((state) => state.endSessionCreation);
  const { showToast } = useToast();
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
    const creationId = beginSessionCreation(sessionId, {
      kind: 'branch',
      label: PUSH_PROGRESS_LABEL,
    });
    showToast('info', 'Pushing this branch to its remote.', { title: 'Push started' });
    try {
      const result = await pushSessionBranch(sessionId);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      showToast('success', 'This branch is pushed to its remote.', { title: 'Push done' });
    } catch (failure) {
      fail(formatError(failure));
    } finally {
      endSessionCreation(sessionId, creationId);
      setIsBusy(false);
    }
  };

  return { isBusy, error, run };
};
