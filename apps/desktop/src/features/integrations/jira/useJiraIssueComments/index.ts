import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { jiraListComments, type JiraComment, type JiraIssue } from '../client';
import { useJiraConfig } from '../useJiraConfig';

type Params = {
  readonly issue: JiraIssue | null;
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly comments: ReadonlyArray<JiraComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
};

export const useJiraIssueComments = ({ issue, workspaceId }: Params): Result => {
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const issueKey = issue?.key ?? null;
  const [comments, setComments] = useState<ReadonlyArray<JiraComment>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setComments([]);
    setError(null);
    if (siteUrl == null || email == null || issueKey == null) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    jiraListComments({ workspaceId, siteUrl, email, issueKey })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setComments(next);
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
  }, [workspaceId, siteUrl, email, issueKey, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { comments, isLoading, error, reload };
};
