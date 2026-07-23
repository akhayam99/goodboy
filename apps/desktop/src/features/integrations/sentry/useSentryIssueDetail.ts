import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../shared/lib/errors';
import { sentryFetchIssueDetail, type SentryIssueDetail } from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string | null;
};

type Detail = SentryIssueDetail & {
  readonly issueId: string;
};

type Result = {
  readonly detail: Detail | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const useSentryIssueDetail = ({ workspaceId, issueId }: Params): Result => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (issueId == null) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    sentryFetchIssueDetail(workspaceId, issueId)
      .then((nextDetail) => {
        if (isCancelled) {
          return;
        }
        setDetail({ ...nextDetail, issueId });
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

  return { detail, isLoading, error };
};
