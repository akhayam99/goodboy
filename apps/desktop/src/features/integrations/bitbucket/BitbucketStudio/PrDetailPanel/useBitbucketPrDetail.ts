import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { PrCheckRun } from '@goodboy/types';
import { bitbucketCheckRuns } from '../../bitbucketCheckRuns';
import {
  bitbucketListPullRequestComments,
  bitbucketListPullRequestStatuses,
  type BitbucketComment,
  type BitbucketPullRequestTarget,
} from '../../client';

type Params = {
  readonly target: BitbucketPullRequestTarget | null;
};

type Loaded = {
  readonly pullRequestId: number | null;
  readonly comments: ReadonlyArray<BitbucketComment>;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

type Result = Readonly<{
  comments: ReadonlyArray<BitbucketComment>;
  checks: ReadonlyArray<PrCheckRun>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}>;

const EMPTY: Loaded = { pullRequestId: null, comments: [], checks: [] };

export const useBitbucketPrDetail = ({ target }: Params): Result => {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const wantedId = target?.pullRequestId ?? null;
  const workspaceId = target?.workspaceId;
  const projectId = target?.projectId;
  const workspaceSlug = target?.workspaceSlug;
  const repoSlug = target?.repoSlug;
  const email = target?.email;
  const isStale = loaded.pullRequestId !== wantedId;

  useEffect(() => {
    if (
      wantedId == null ||
      workspaceId === undefined ||
      workspaceSlug === undefined ||
      repoSlug === undefined ||
      email === undefined
    ) {
      setLoaded(EMPTY);
      setIsFetching(false);
      setError(null);
      return;
    }
    const request: BitbucketPullRequestTarget = {
      workspaceId,
      projectId,
      workspaceSlug,
      repoSlug,
      email,
      pullRequestId: wantedId,
    };
    let isCancelled = false;
    setIsFetching(true);
    setError(null);
    Promise.all([
      bitbucketListPullRequestComments(request),
      bitbucketListPullRequestStatuses(request),
    ])
      .then(([nextComments, statuses]) => {
        if (isCancelled) {
          return;
        }
        setLoaded({
          pullRequestId: wantedId,
          comments: nextComments.filter((comment) => comment.deleted === false),
          checks: bitbucketCheckRuns({ statuses }),
        });
        setIsFetching(false);
      })
      .catch((fetchError: unknown) => {
        if (isCancelled) {
          return;
        }
        setError(formatError(fetchError));
        setIsFetching(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [wantedId, workspaceId, projectId, workspaceSlug, repoSlug, email, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return {
    comments: isStale ? [] : loaded.comments,
    checks: isStale ? [] : loaded.checks,
    isLoading: isFetching || (wantedId != null && isStale && error == null),
    error,
    reload,
  };
};
