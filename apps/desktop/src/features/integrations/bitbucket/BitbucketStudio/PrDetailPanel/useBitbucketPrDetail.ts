import { useCallback, useEffect, useState } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import { formatError } from '../../../../../shared/lib/errors';
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
  const isStale = loaded.pullRequestId !== wantedId;

  useEffect(() => {
    if (target == null) {
      setLoaded(EMPTY);
      setIsFetching(false);
      setError(null);
      return;
    }
    let isCancelled = false;
    setIsFetching(true);
    setError(null);
    Promise.all([
      bitbucketListPullRequestComments(target),
      bitbucketListPullRequestStatuses(target),
    ])
      .then(([nextComments, statuses]) => {
        if (isCancelled) {
          return;
        }
        setLoaded({
          pullRequestId: target.pullRequestId,
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
  }, [target, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return {
    comments: isStale ? [] : loaded.comments,
    checks: isStale ? [] : loaded.checks,
    isLoading: isFetching || (wantedId != null && isStale && error == null),
    error,
    reload,
  };
};
