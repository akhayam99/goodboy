import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GitlabIntegrationBinding,
  Session,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { useAppStore, useSessions } from '../../../../store';
import { gitlabFetchAssignedIssues, type GitlabIssue } from '../client';
import { linkedTaskKey, useLinkedExternalIds } from '../../hooks/useLinkedExternalIds';

const SLUG_MAX_LEN = 48;
const GITLAB_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['gitlab'];

const slugify = (input: string): string => {
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

type GitlabIssueRow = {
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
  linkedSessions: ReadonlyMap<string, SessionId>,
): Map<string, SessionId> => {
  const byIssue = new Map<string, SessionId>();
  for (const issue of issues) {
    const key = String(issue.id);
    const linked = linkedSessions.get(linkedTaskKey({ provider: 'gitlab', externalId: key }));
    if (linked !== undefined) {
      byIssue.set(key, linked);
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

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly isEnabled?: boolean;
};

export const useGitlabIssues = ({ workspaceId, isEnabled = true }: HookParams): UseGitlabIssues => {
  const sessions = useSessions();
  const linkedSessions = useLinkedExternalIds({ providers: GITLAB_PROVIDERS, sessions });
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const host = useAppStore((s) => {
    const integration = s.workspaceIntegrations[workspaceId]?.find(
      (i): i is GitlabIntegrationBinding => i.provider === 'gitlab',
    );
    return integration ? integration.config.host : null;
  });
  const [issues, setIssues] = useState<ReadonlyArray<GitlabIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!isEnabled) {
      setIssues([]);
      setLoading(false);
      setError(null);
      return;
    }
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
  }, [workspaceId, host, isEnabled]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions(issues, sessions, sessionBranches, linkedSessions),
    [issues, sessions, sessionBranches, linkedSessions],
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
