import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore, useSessions } from '../../../../store';
import {
  issuePullRequests,
  linearFetchAssignedIssues,
  prRepoFromUrl,
  type LinearIssue,
} from '../client';
import { useLatestFetch } from '../../hooks/useLatestFetch';
import { useLinkedExternalIds } from '../../hooks/useLinkedExternalIds';
import { sessionByExternalId } from '../../shared/sessionByExternalId';
import { buildIssueGroups, type LinearIssueGroup } from './buildIssueGroups';

const LINEAR_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['linear'];

export type SessionPrRef = {
  readonly number: number;
  readonly repo: string | null;
};

type PrRefParams = {
  readonly number: number;
  readonly url: string;
};

const sessionPrRefFromUrl = ({ number, url }: PrRefParams): SessionPrRef => {
  return { number, repo: prRepoFromUrl(url) };
};

type SameRepoParams = {
  readonly left: string | null;
  readonly right: string | null;
};

const sameRepo = ({ left, right }: SameRepoParams): boolean =>
  !left || !right ? true : left.toLowerCase() === right.toLowerCase();

type MatchParams = {
  readonly session: Session;
  readonly issue: LinearIssue;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly sessionPr: ReadonlyMap<string, SessionPrRef>;
};

const sessionMatchesIssue = ({
  session,
  issue,
  sessionBranches,
  sessionPr,
}: MatchParams): boolean => {
  const pr = sessionPr.get(session.id);
  if (
    pr &&
    issuePullRequests(issue).some(
      (candidate) =>
        candidate.number === pr.number && sameRepo({ left: candidate.repo, right: pr.repo }),
    )
  ) {
    return true;
  }
  const branch = sessionBranches[session.id];
  return Boolean(
    branch && issue.branchName && branch.toLowerCase() === issue.branchName.toLowerCase(),
  );
};

type ResolveParams = {
  readonly issues: ReadonlyArray<LinearIssue>;
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
  readonly sessionPr: ReadonlyMap<string, SessionPrRef>;
};

export const resolveIssueSessions = ({
  issues,
  sessions,
  sessionBranches,
  linkedSessions,
  sessionPr,
}: ResolveParams): Map<string, SessionId> =>
  sessionByExternalId({
    issues,
    sessions,
    linkedSessions,
    provider: 'linear',
    externalIdOf: ({ issue }) => issue.id,
    isSessionOfIssue: ({ issue, session }) =>
      sessionMatchesIssue({ session, issue, sessionBranches, sessionPr }),
  });

export type UseLinearIssues = {
  readonly groups: ReadonlyArray<LinearIssueGroup>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useLinearIssues = (workspaceId: WorkspaceId, isEnabled = true): UseLinearIssues => {
  const sessions = useSessions();
  const linkedSessions = useLinkedExternalIds({ providers: LINEAR_PROVIDERS, sessions });
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const [issues, setIssues] = useState<ReadonlyArray<LinearIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const rows = await linearFetchAssignedIssues(workspaceId);
      if (isStale()) {
        return;
      }
      setIssues(rows);
    } catch (err) {
      if (isStale()) {
        return;
      }
      setError(formatError(err));
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, [beginFetch, isEnabled, workspaceId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionPr = useMemo(() => {
    const map = new Map<string, SessionPrRef>();
    for (const [sessionId, gh] of Object.entries(sessionGithub)) {
      const pr = gh?.pr;
      if (pr) {
        map.set(sessionId, sessionPrRefFromUrl({ number: pr.number, url: pr.url }));
      }
    }
    return map;
  }, [sessionGithub]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions({ issues, sessions, sessionBranches, linkedSessions, sessionPr }),
    [issues, sessions, sessionBranches, linkedSessions, sessionPr],
  );

  const groups = useMemo(
    () => buildIssueGroups({ issues, sessionIdByExternalId: sessionIdByIssueId }),
    [issues, sessionIdByIssueId],
  );

  return {
    groups,
    loading,
    error,
    refetch: () => void fetchIssues(),
  };
};
