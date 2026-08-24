import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { gitlabFetchAssignedMrs, type GitlabMergeRequest } from '../../client';

export type GitlabMrGroup = Readonly<{
  key: string;
  label: string;
  rows: ReadonlyArray<GitlabMergeRequest>;
}>;

type Params = {
  readonly webUrl: string;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly isEnabled?: boolean;
};

type GroupsParams = {
  readonly mrs: ReadonlyArray<GitlabMergeRequest>;
};

type Result = Readonly<{
  groups: ReadonlyArray<GitlabMrGroup>;
  host: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}>;

export const projectPathFromMrUrl = ({ webUrl }: Params): string | null => {
  try {
    const marker = '/-/merge_requests/';
    const path = new URL(webUrl).pathname;
    const markerIndex = path.indexOf(marker);
    return markerIndex < 0 ? path.replace(/^\//, '') : path.slice(1, markerIndex);
  } catch {
    return null;
  }
};

export const buildGitlabMrGroups = ({ mrs }: GroupsParams): ReadonlyArray<GitlabMrGroup> => {
  const buckets = new Map<string, GitlabMergeRequest[]>();
  for (const mr of mrs) {
    const key = projectPathFromMrUrl({ webUrl: mr.webUrl }) ?? 'Merge requests';
    buckets.set(key, [...(buckets.get(key) ?? []), mr]);
  }
  return [...buckets.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      label: key,
      rows: (buckets.get(key) ?? []).sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    }));
};

export const useGitlabMrs = ({ workspaceId, isEnabled = true }: HookParams): Result => {
  const host = useAppStore((state) => {
    const integration = state.workspaceIntegrations[workspaceId]?.find(
      (candidate): candidate is GitlabIntegrationBinding => candidate.provider === 'gitlab',
    );
    return integration?.config.host ?? null;
  });
  const [mrs, setMrs] = useState<ReadonlyArray<GitlabMergeRequest>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMrs = useCallback(async () => {
    if (!isEnabled) {
      setMrs([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (host == null) {
      setMrs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMrs(await gitlabFetchAssignedMrs(workspaceId, host));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    } finally {
      setLoading(false);
    }
  }, [host, isEnabled, workspaceId]);

  useEffect(() => {
    void fetchMrs();
  }, [fetchMrs]);

  const groups = useMemo(() => buildGitlabMrGroups({ mrs }), [mrs]);
  return { groups, host, loading, error, refetch: () => void fetchMrs() };
};
