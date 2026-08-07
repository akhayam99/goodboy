import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../shared/lib/errors';
import { linearFetchIssue, type LinearIssue } from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
};

type Result = {
  readonly issue: LinearIssue | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useLinearIssue = ({ workspaceId, issueId }: Params): Result => {
  const [issue, setIssue] = useState<LinearIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    setIssue(null);
    setError(null);
    setIsLoading(true);
    linearFetchIssue({ workspaceId, issueId })
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
  }, [issueId, workspaceId, attempt]);

  return { issue, isLoading, error, refetch: () => setAttempt((count) => count + 1) };
};
