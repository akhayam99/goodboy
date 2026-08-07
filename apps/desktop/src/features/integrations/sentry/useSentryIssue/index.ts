import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { sentryFetchIssue, type SentryIssue } from '../client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string | null;
};

type Result = {
  readonly issue: SentryIssue | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useSentryIssue = ({ workspaceId, issueId }: Params): Result => {
  const [issue, setIssue] = useState<SentryIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setIssue(null);
    setError(null);
    if (issueId == null || issueId === '') {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    sentryFetchIssue({ workspaceId, issueId })
      .then((nextIssue) => {
        if (isCancelled) {
          return;
        }
        setIssue(nextIssue);
      })
      .catch((fetchError: unknown) => {
        if (isCancelled) {
          return;
        }
        setError(formatError(fetchError));
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, issueId, attempt]);

  return { issue, isLoading, error, refetch: () => setAttempt((n) => n + 1) };
};
