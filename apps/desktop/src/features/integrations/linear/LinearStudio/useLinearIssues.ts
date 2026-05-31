import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSessions } from '../../../../store';
import {
  issuePullRequests,
  linearFetchAssignedIssues,
  prRepoFromUrl,
  type LinearIssue,
} from '../client';

export type LinearGroupKey = 'started' | 'unstarted' | 'backlog' | 'triage' | 'other';

const GROUP_ORDER: ReadonlyArray<LinearGroupKey> = [
  'started',
  'unstarted',
  'backlog',
  'triage',
  'other',
];

const GROUP_LABEL: Record<LinearGroupKey, string> = {
  started: 'In Progress',
  unstarted: 'Todo',
  backlog: 'Backlog',
  triage: 'Triage',
  other: 'Other',
};

function groupKeyForStateType(type: string): LinearGroupKey {
  switch (type) {
    case 'started':
      return 'started';
    case 'unstarted':
      return 'unstarted';
    case 'backlog':
      return 'backlog';
    case 'triage':
      return 'triage';
    default:
      return 'other';
  }
}

export interface LinearIssueRow {
  readonly issue: LinearIssue;
  readonly sessionId: SessionId | null;
}

export interface LinearIssueGroup {
  readonly key: LinearGroupKey;
  readonly label: string;
  readonly rows: ReadonlyArray<LinearIssueRow>;
}

export function buildIssueGroups(
  issues: ReadonlyArray<LinearIssue>,
  sessionIdByExternalId: ReadonlyMap<string, SessionId>,
): ReadonlyArray<LinearIssueGroup> {
  const buckets = new Map<LinearGroupKey, LinearIssueRow[]>();
  for (const issue of issues) {
    const key = groupKeyForStateType(issue.state.type);
    const row: LinearIssueRow = {
      issue,
      sessionId: sessionIdByExternalId.get(issue.id) ?? null,
    };
    const arr = buckets.get(key);
    if (arr) arr.push(row);
    else buckets.set(key, [row]);
  }
  const sortRows = (rows: LinearIssueRow[]): LinearIssueRow[] =>
    rows.sort((a, b) => b.issue.updatedAt.localeCompare(a.issue.updatedAt));
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: GROUP_LABEL[key],
    rows: sortRows(buckets.get(key)!),
  }));
}

export interface SessionPrRef {
  readonly number: number;
  readonly repo: string | null;
}

export function sessionPrRefFromUrl(number: number, url: string): SessionPrRef {
  return { number, repo: prRepoFromUrl(url) };
}

function sameRepo(a: string | null, b: string | null): boolean {
  return !a || !b ? true : a.toLowerCase() === b.toLowerCase();
}

function sessionMatchesIssue(
  session: Session,
  issue: LinearIssue,
  sessionBranches: Readonly<Record<string, string>>,
  sessionPr: ReadonlyMap<string, SessionPrRef>,
): boolean {
  const pr = sessionPr.get(session.id);
  if (
    pr &&
    issuePullRequests(issue).some((p) => p.number === pr.number && sameRepo(p.repo, pr.repo))
  ) {
    return true;
  }
  const branch = sessionBranches[session.id];
  return Boolean(
    branch && issue.branchName && branch.toLowerCase() === issue.branchName.toLowerCase(),
  );
}

export function resolveIssueSessions(
  issues: ReadonlyArray<LinearIssue>,
  sessions: ReadonlyArray<Session>,
  sessionBranches: Readonly<Record<string, string>>,
  sessionExternalTasks: Readonly<Record<string, SessionExternalTask>>,
  sessionPr: ReadonlyMap<string, SessionPrRef>,
): Map<string, SessionId> {
  const byIssue = new Map<string, SessionId>();
  for (const session of sessions) {
    const task = sessionExternalTasks[session.id];
    if (task && task.provider === 'linear' && !byIssue.has(task.externalId)) {
      byIssue.set(task.externalId, session.id);
    }
  }
  for (const issue of issues) {
    if (byIssue.has(issue.id)) continue;
    const match = sessions.find((s) => sessionMatchesIssue(s, issue, sessionBranches, sessionPr));
    if (match) byIssue.set(issue.id, match.id);
  }
  return byIssue;
}

export interface UseLinearIssues {
  readonly groups: ReadonlyArray<LinearIssueGroup>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useLinearIssues(workspaceId: WorkspaceId): UseLinearIssues {
  const sessions = useSessions();
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const [issues, setIssues] = useState<ReadonlyArray<LinearIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await linearFetchAssignedIssues(workspaceId);
      setIssues(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionPr = useMemo(() => {
    const map = new Map<string, SessionPrRef>();
    for (const [sessionId, gh] of Object.entries(sessionGithub)) {
      const pr = gh?.pr;
      if (pr) map.set(sessionId, sessionPrRefFromUrl(pr.number, pr.url));
    }
    return map;
  }, [sessionGithub]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions(issues, sessions, sessionBranches, sessionExternalTasks, sessionPr),
    [issues, sessions, sessionBranches, sessionExternalTasks, sessionPr],
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
}
