import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectRepoSlug } from '@goodboy/core';
import type { GithubIssue, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { useAppStore } from '../../../../store';
import { ghAssignedIssues, tauriGhRunner } from '../../github';

export type GithubIssueRow = Readonly<{
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
  readonly externalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
};

type BranchParams = {
  readonly issue: GithubIssue;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
};

type Result = Readonly<{
  groups: ReadonlyArray<GithubIssueGroup>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}>;

export const githubBranchSlug = ({ issue }: BranchParams): string =>
  `${issue.number}-${slugifyBranch({ input: issue.title, maxLength: 48 })}`;

export const buildGithubIssueGroups = ({
  issues,
  externalTasks,
}: GroupsParams): ReadonlyArray<GithubIssueGroup> => {
  const sessionIdByExternalId = new Map<string, SessionId>();
  for (const [sessionId, tasks] of Object.entries(externalTasks)) {
    for (const task of tasks) {
      if (task.provider === 'github' && !sessionIdByExternalId.has(task.externalId)) {
        sessionIdByExternalId.set(task.externalId, sessionId as SessionId);
      }
    }
  }
  const rows = [...issues]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((issue) => ({
      issue,
      sessionId: sessionIdByExternalId.get(String(issue.number)) ?? null,
    }));
  return rows.length === 0 ? [] : [{ key: 'open', label: 'Open', rows }];
};

export const useGithubIssues = ({ workspaceId, rootPath }: HookParams): Result => {
  const externalTasks = useAppStore((state) => state.sessionExternalTasks);
  const [issues, setIssues] = useState<ReadonlyArray<GithubIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const slug = await detectRepoSlug(tauriGhRunner, rootPath, workspaceId);
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
  }, [rootPath, workspaceId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const groups = useMemo(
    () => buildGithubIssueGroups({ issues, externalTasks }),
    [externalTasks, issues],
  );

  return { groups, loading, error, refetch: () => void fetchIssues() };
};
