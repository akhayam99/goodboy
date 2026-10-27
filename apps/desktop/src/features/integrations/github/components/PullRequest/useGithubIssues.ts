import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectRepoSlug } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  GithubIssue,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { ghAssignedIssues, tauriGhRunner } from '../../github';
import { useLatestFetch } from '../../../hooks/useLatestFetch';
import { useLinkedExternalIds } from '../../../hooks/useLinkedExternalIds';
import { groupIssuesBy, type IssueGroup } from '../../../shared/groupIssuesBy';
import { sessionByExternalId } from '../../../shared/sessionByExternalId';

const GITHUB_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['github'];

export type GithubIssueGroup = IssueGroup<string, GithubIssue>;

type GroupsParams = {
  readonly issues: ReadonlyArray<GithubIssue>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly isEnabled?: boolean;
};

type Result = Readonly<{
  groups: ReadonlyArray<GithubIssueGroup>;
  loading: boolean;
  error: string | null;
  hasRemote: boolean | null;
  refetch: () => void;
}>;

export const buildGithubIssueGroups = ({
  issues,
  linkedSessions,
}: GroupsParams): ReadonlyArray<GithubIssueGroup> =>
  groupIssuesBy<GithubIssue, string>({
    issues,
    sessionIdByExternalId: sessionByExternalId({
      issues,
      sessions: [],
      linkedSessions,
      provider: 'github',
      externalIdOf: ({ issue }) => String(issue.number),
      isSessionOfIssue: () => false,
    }),
    externalIdOf: ({ issue }) => String(issue.number),
    keyOf: () => 'open',
    labelOf: () => 'Open',
    updatedAtOf: ({ issue }) => issue.updatedAt,
    order: ['open'],
  });

export const useGithubIssues = ({
  workspaceId,
  rootPath,
  isEnabled = true,
}: HookParams): Result => {
  const linkedSessions = useLinkedExternalIds({ providers: GITHUB_PROVIDERS });
  const [issues, setIssues] = useState<ReadonlyArray<GithubIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState<boolean | null>(null);
  const beginFetch = useLatestFetch();

  const fetchIssues = useCallback(async () => {
    const isStale = beginFetch();
    if (!isEnabled) {
      setIssues([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const slug = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId);
      if (isStale()) {
        return;
      }
      setHasRemote(slug != null);
      if (slug == null) {
        setIssues([]);
        return;
      }
      const rows = await ghAssignedIssues(slug, { cwd: rootPath, workspaceId });
      if (isStale()) {
        return;
      }
      setIssues(rows);
    } catch (fetchError) {
      if (isStale()) {
        return;
      }
      setError(formatError(fetchError));
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, [beginFetch, isEnabled, rootPath, workspaceId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const groups = useMemo(
    () => buildGithubIssueGroups({ issues, linkedSessions }),
    [issues, linkedSessions],
  );

  return { groups, loading, error, hasRemote, refetch: () => void fetchIssues() };
};
