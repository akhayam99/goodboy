import { useEffect, useState } from 'react';
import type { GithubIssue, WorkspaceId } from '@goodboy/types';
import { formatError } from '../../shared/lib/errors';
import { ghIssueByNumber } from './github';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly issueNumber: number;
};

type Result = {
  readonly issue: GithubIssue | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useGithubIssue = ({ workspaceId, rootPath, issueNumber }: Params): Result => {
  const [issue, setIssue] = useState<GithubIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (rootPath == null) {
      setIssue(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIssue(null);
    setError(null);
    setIsLoading(true);
    ghIssueByNumber(rootPath, issueNumber, workspaceId)
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
  }, [rootPath, issueNumber, workspaceId, attempt]);

  return { issue, isLoading, error, refetch: () => setAttempt((n) => n + 1) };
};
