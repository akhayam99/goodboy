import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GitlabWorkspaceIntegration,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { useAppStore, useSessions } from '../../../../store';
import { gitlabFetchAssignedIssues, type GitlabIssue } from '../client';

const SLUG_MAX_LEN = 48;

export const slugify = (input: string): string => {
  return slugifyBranch({ input, maxLength: SLUG_MAX_LEN });
};

export const gitlabBranchSlug = (issue: GitlabIssue): string => {
  return `${issue.iid}-${slugify(issue.title)}`;
};

export const projectPathFromIssue = (issue: GitlabIssue): string => {
  const full = issue.references?.full ?? '';
  const idx = full.indexOf('#');
  const path = (idx >= 0 ? full.slice(0, idx) : full).trim();
  return path || 'issues';
};

export type GitlabIssueRow = {
  readonly issue: GitlabIssue;
  readonly sessionId: SessionId | null;
};

export type GitlabIssueGroup = {
  readonly key: string;
  readonly label: string;
  readonly rows: ReadonlyArray<GitlabIssueRow>;
};

export const buildIssueGroups = (
  issues: ReadonlyArray<GitlabIssue>,
  sessionIdByExternalId: ReadonlyMap<string, SessionId>,
): ReadonlyArray<GitlabIssueGroup> => {
  const buckets = new Map<string, GitlabIssueRow[]>();
  for (const issue of issues) {
    const key = projectPathFromIssue(issue);
    const row: GitlabIssueRow = {
      issue,
      sessionId: sessionIdByExternalId.get(String(issue.id)) ?? null,
    };
    const arr = buckets.get(key);
    if (arr) {
      arr.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }
  const sortRows = (rows: GitlabIssueRow[]): GitlabIssueRow[] =>
    rows.sort((a, b) => b.issue.updatedAt.localeCompare(a.issue.updatedAt));
  return [...buckets.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: key, rows: sortRows(buckets.get(key)!) }));
};

const branchTail = (branch: string): string => {
  const lower = branch.toLowerCase();
  const idx = lower.lastIndexOf('/');
  return idx >= 0 ? lower.slice(idx + 1) : lower;
};

const sessionMatchesIssue = (
  session: Session,
  issue: GitlabIssue,
  sessionBranches: Readonly<Record<string, string>>,
): boolean => {
  const branch = sessionBranches[session.id];
  if (!branch) {
    return false;
  }
  return branchTail(branch) === gitlabBranchSlug(issue).toLowerCase();
};

export const resolveIssueSessions = (
  issues: ReadonlyArray<GitlabIssue>,
  sessions: ReadonlyArray<Session>,
  sessionBranches: Readonly<Record<string, string>>,
  sessionExternalTasks: Readonly<Record<string, SessionExternalTask>>,
): Map<string, SessionId> => {
  const byIssue = new Map<string, SessionId>();
  for (const session of sessions) {
    const task = sessionExternalTasks[session.id];
    if (task && task.provider === 'gitlab' && !byIssue.has(task.externalId)) {
      byIssue.set(task.externalId, session.id);
    }
  }
  for (const issue of issues) {
    const key = String(issue.id);
    if (byIssue.has(key)) {
      continue;
    }
    const match = sessions.find((s) => sessionMatchesIssue(s, issue, sessionBranches));
    if (match) {
      byIssue.set(key, match.id);
    }
  }
  return byIssue;
};

export type UseGitlabIssues = {
  readonly groups: ReadonlyArray<GitlabIssueGroup>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useGitlabIssues = (workspaceId: WorkspaceId): UseGitlabIssues => {
  const sessions = useSessions();
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const host = useAppStore((s) => {
    const integration = s.workspaceIntegrations[workspaceId]?.find(
      (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
    );
    return integration ? integration.config.host : null;
  });
  const [issues, setIssues] = useState<ReadonlyArray<GitlabIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!host) {
      setIssues([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await gitlabFetchAssignedIssues(workspaceId, host);
      setIssues(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, host]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions(issues, sessions, sessionBranches, sessionExternalTasks),
    [issues, sessions, sessionBranches, sessionExternalTasks],
  );

  const groups = useMemo(
    () => buildIssueGroups(issues, sessionIdByIssueId),
    [issues, sessionIdByIssueId],
  );

  return {
    groups,
    loading,
    error,
    refetch: () => void fetchIssues(),
  };
};
