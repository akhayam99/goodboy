import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { linearCreateComment, linearFetchIssueComments, type LinearIssueComment } from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string | null;
};

type Result = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly post: ((body: string) => Promise<void>) | null;
};

export const useLinearIssueComments = ({ workspaceId, issueId }: Params): Result => {
  const [comments, setComments] = useState<ReadonlyArray<LinearIssueComment>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComments([]);
    setError(null);
    if (issueId == null) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    linearFetchIssueComments({ workspaceId, issueId })
      .then((nextComments) => {
        if (isCancelled) {
          return;
        }
        setComments(nextComments);
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
  }, [issueId, workspaceId]);

  const post = useCallback(
    async (body: string) => {
      if (issueId == null) {
        return;
      }
      const created = await linearCreateComment({ workspaceId, issueId, body });
      setComments((current) => [...current, created]);
    },
    [issueId, workspaceId],
  );

  return { comments, isLoading, error, post: issueId != null ? post : null };
};
