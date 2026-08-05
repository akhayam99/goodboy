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

type Result = Readonly<{
  comments: ReadonlyArray<BitbucketComment>;
  checks: ReadonlyArray<PrCheckRun>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}>;

export const useBitbucketPrDetail = ({ target }: Params): Result => {
  const [comments, setComments] = useState<ReadonlyArray<BitbucketComment>>([]);
  const [checks, setChecks] = useState<ReadonlyArray<PrCheckRun>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (target == null) {
      setComments([]);
      setChecks([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      bitbucketListPullRequestComments(target),
      bitbucketListPullRequestStatuses(target),
    ])
      .then(([nextComments, statuses]) => {
        if (isCancelled) {
          return;
        }
        setComments(nextComments.filter((comment) => comment.deleted === false));
        setChecks(bitbucketCheckRuns({ statuses }));
        setIsLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (isCancelled) {
          return;
        }
        setError(formatError(fetchError));
        setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [target, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { comments, checks, isLoading, error, reload };
};
