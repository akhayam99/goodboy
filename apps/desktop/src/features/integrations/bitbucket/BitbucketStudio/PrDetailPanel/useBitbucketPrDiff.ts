import { useCallback, useEffect, useState } from 'react';
import { parseUnifiedDiff } from '@goodboy/core';
import type { FileDiff } from '@goodboy/types';
import { formatError } from '../../../../../shared/lib/errors';
import { bitbucketPullRequestDiff, type BitbucketPullRequestTarget } from '../../client';

type Params = {
  readonly target: BitbucketPullRequestTarget | null;
  readonly isEnabled: boolean;
};

type Result = Readonly<{
  files: ReadonlyArray<FileDiff>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}>;

export const useBitbucketPrDiff = ({ target, isEnabled }: Params): Result => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (target == null || !isEnabled) {
      return;
    }
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    bitbucketPullRequestDiff(target)
      .then((raw) => {
        if (isCancelled) {
          return;
        }
        setFiles(parseUnifiedDiff(raw));
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
  }, [isEnabled, target, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { files, isLoading, error, reload };
};
