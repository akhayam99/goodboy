import { formatError } from '@goodboy/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectRepoSlug } from '@goodboy/core';
import type {
  GithubInboxPrRole,
  GithubInboxPullRequest,
  PullRequestState,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { ghInboxPullRequests, tauriGhRunner } from '../../../github';
import {
  linkedTaskKey,
  useLinkedExternalIds,
} from '../../../../integrations/hooks/useLinkedExternalIds';
import { compareIsoDesc } from '../../../../../shared/utils/compareIsoDesc';

const GITHUB_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['github'];

type GithubPrRow = Readonly<{
  pr: PullRequestState;
  role: GithubInboxPrRole;
  sessionId: SessionId | null;
}>;

export type GithubPrGroup = Readonly<{
  key: GithubInboxPrRole;
  label: string;
  rows: ReadonlyArray<GithubPrRow>;
}>;

type GroupsParams = {
  readonly pullRequests: ReadonlyArray<GithubInboxPullRequest>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly isEnabled?: boolean;
};

type Result = Readonly<{
  groups: ReadonlyArray<GithubPrGroup>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}>;

const GROUPS: ReadonlyArray<{ readonly key: GithubInboxPrRole; readonly label: string }> = [
  { key: 'review-requested', label: 'Review requested' },
  { key: 'author', label: 'Your pull requests' },
];

export const buildGithubPrGroups = ({
  pullRequests,
  linkedSessions,
}: GroupsParams): ReadonlyArray<GithubPrGroup> =>
  GROUPS.map(({ key, label }) => ({
    key,
    label,
    rows: pullRequests
      .filter((entry) => entry.role === key)
      .sort((left, right) => compareIsoDesc({ left: left.pr.updatedAt, right: right.pr.updatedAt }))
      .map(({ pr, role }) => ({
        pr,
        role,
        sessionId:
          linkedSessions.get(
            linkedTaskKey({ provider: 'github', externalId: String(pr.number) }),
          ) ?? null,
      })),
  })).filter((group) => group.rows.length > 0);

export const useGithubPrs = ({ workspaceId, rootPath, isEnabled = true }: HookParams): Result => {
  const linkedSessions = useLinkedExternalIds({ providers: GITHUB_PROVIDERS });
  const [pullRequests, setPullRequests] = useState<ReadonlyArray<GithubInboxPullRequest>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrs = useCallback(async () => {
    if (!isEnabled) {
      setPullRequests([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const slug = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId);
      if (slug == null) {
        setPullRequests([]);
        return;
      }
      setPullRequests(await ghInboxPullRequests(slug, { cwd: rootPath, workspaceId }));
    } catch (fetchError) {
      setError(formatError(fetchError));
    } finally {
      setLoading(false);
    }
  }, [isEnabled, rootPath, workspaceId]);

  useEffect(() => {
    void fetchPrs();
  }, [fetchPrs]);

  const groups = useMemo(
    () => buildGithubPrGroups({ pullRequests, linkedSessions }),
    [pullRequests, linkedSessions],
  );

  return { groups, loading, error, refetch: () => void fetchPrs() };
};
