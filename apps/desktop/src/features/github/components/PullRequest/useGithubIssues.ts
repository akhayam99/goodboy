import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectRepoSlug } from '@goodboy/core';
import type {
  GithubIssue,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { ghAssignedIssues, tauriGhRunner } from '../../github';
import {
  linkedTaskKey,
  useLinkedExternalIds,
} from '../../../integrations/hooks/useLinkedExternalIds';

const GITHUB_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['github'];

type GithubIssueRow = Readonly<{
  issue: GithubIssue;
  sessionId: SessionId | null;
}>;

export type GithubIssueGroup = Readonly<{
  key: string;
  label: string;
  rows: ReadonlyArray<GithubIssueRow>;
}>;

type GroupsParams = {
  readonly issues: ReadonlyArray<GithubIssue>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
};

type BranchParams = {
  readonly issue: GithubIssue;
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

export const githubBranchSlug = ({ issue }: BranchParams): string =>
  `${issue.number}-${slugifyBranch({ input: issue.title, maxLength: 48 })}`;

export const buildGithubIssueGroups = ({
  issues,
  linkedSessions,
}: GroupsParams): ReadonlyArray<GithubIssueGroup> => {
  const rows = [...issues]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((issue) => ({
      issue,
      sessionId:
        linkedSessions.get(
          linkedTaskKey({ provider: 'github', externalId: String(issue.number) }),
        ) ?? null,
    }));
  return rows.length === 0 ? [] : [{ key: 'open', label: 'Open', rows }];
};

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

  const fetchIssues = useCallback(async () => {
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
      setHasRemote(slug != null);
      if (slug == null) {
        setIssues([]);
        return;
      }
      setIssues(await ghAssignedIssues(slug, { cwd: rootPath, workspaceId }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    } finally {
      setLoading(false);
    }
  }, [isEnabled, rootPath, workspaceId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const groups = useMemo(
    () => buildGithubIssueGroups({ issues, linkedSessions }),
    [issues, linkedSessions],
  );

  return { groups, loading, error, hasRemote, refetch: () => void fetchIssues() };
};
