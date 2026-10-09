import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import {
  bitbucketListPullRequests,
  type BitbucketPullRequest,
  type BitbucketRepo,
} from '../../client';
import { compareIsoDesc } from '../../../../../shared/utils/compareIsoDesc';
import { bitbucketPrStateKind } from '@goodboy/core';

export type BitbucketPrGroup = Readonly<{
  key: string;
  label: string;
  rows: ReadonlyArray<BitbucketPullRequest>;
}>;

type GroupsParams = {
  readonly pullRequests: ReadonlyArray<BitbucketPullRequest>;
};

type HookParams = {
  readonly repo: BitbucketRepo | null;
};

type Result = Readonly<{
  groups: ReadonlyArray<BitbucketPrGroup>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}>;

const GROUP_ORDER: ReadonlyArray<string> = ['Open', 'Merged', 'Closed'];

type BucketParams = {
  readonly pullRequest: BitbucketPullRequest;
};

const bucketOf = ({ pullRequest }: BucketParams): string => {
  const kind = bitbucketPrStateKind({ state: pullRequest.state });
  if (kind === 'open') {
    return 'Open';
  }
  if (kind === 'merged') {
    return 'Merged';
  }
  return 'Closed';
};

const buildBitbucketPrGroups = ({
  pullRequests,
}: GroupsParams): ReadonlyArray<BitbucketPrGroup> => {
  const buckets = new Map<string, BitbucketPullRequest[]>();
  for (const pullRequest of pullRequests) {
    const key = bucketOf({ pullRequest });
    buckets.set(key, [...(buckets.get(key) ?? []), pullRequest]);
  }
  return GROUP_ORDER.filter((key) => (buckets.get(key) ?? []).length > 0).map((key) => ({
    key,
    label: key,
    rows: (buckets.get(key) ?? []).sort((left, right) =>
      compareIsoDesc({ left: left.updatedOn, right: right.updatedOn }),
    ),
  }));
};

export const useBitbucketPrs = ({ repo }: HookParams): Result => {
  const [pullRequests, setPullRequests] = useState<ReadonlyArray<BitbucketPullRequest>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrs = useCallback(async () => {
    if (repo == null) {
      setPullRequests([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPullRequests(await bitbucketListPullRequests(repo));
    } catch (fetchError) {
      setError(formatError(fetchError));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void fetchPrs();
  }, [fetchPrs]);

  const groups = useMemo(() => buildBitbucketPrGroups({ pullRequests }), [pullRequests]);
  return { groups, loading, error, refetch: () => void fetchPrs() };
};
