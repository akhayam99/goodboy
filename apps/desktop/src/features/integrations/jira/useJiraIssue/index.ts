import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { jiraGetIssue, type JiraIssue } from '../client';
import { useJiraConfig } from '../useJiraConfig';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueKey: string;
};

type Result = {
  readonly issue: JiraIssue | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useJiraIssue = ({ workspaceId, issueKey }: Params): Result => {
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (siteUrl == null || email == null || issueKey === '') {
      setIssue(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIssue(null);
    setError(null);
    setIsLoading(true);
    jiraGetIssue({ workspaceId, siteUrl, email, issueKey })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setIssue(next);
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
  }, [workspaceId, siteUrl, email, issueKey, attempt]);

  return { issue, isLoading, error, refetch: () => setAttempt((count) => count + 1) };
};
