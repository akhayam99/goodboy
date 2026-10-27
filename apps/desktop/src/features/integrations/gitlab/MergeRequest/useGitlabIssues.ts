import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GitlabIntegrationBinding,
  Session,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { issueBranchMatches } from '../../../../shared/utils/issueBranchSlug';
import { useAppStore, useSessions } from '../../../../store';
import { gitlabFetchAssignedIssues, type GitlabIssue } from '../client';
import { useLatestFetch } from '../../hooks/useLatestFetch';
import { useLinkedExternalIds } from '../../hooks/useLinkedExternalIds';
import { groupIssuesBy, type IssueGroup } from '../../shared/groupIssuesBy';
import { sessionByExternalId } from '../../shared/sessionByExternalId';

const GITLAB_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['gitlab'];

export const projectPathFromIssue = (issue: GitlabIssue): string => {
  const full = issue.references?.full ?? '';
  const idx = full.indexOf('#');
  const path = (idx >= 0 ? full.slice(0, idx) : full).trim();
  return path || 'issues';
};

export type GitlabIssueGroup = IssueGroup<string, GitlabIssue>;

type GroupParams = {
  readonly issues: ReadonlyArray<GitlabIssue>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
};

export const buildIssueGroups = ({
  issues,
  sessionIdByExternalId,
}: GroupParams): ReadonlyArray<GitlabIssueGroup> =>
  groupIssuesBy({
    issues,
    sessionIdByExternalId,
    externalIdOf: ({ issue }) => String(issue.id),
    keyOf: ({ issue }) => projectPathFromIssue(issue),
    labelOf: ({ key }) => key,
    updatedAtOf: ({ issue }) => issue.updatedAt,
    order: null,
  });

type ResolveParams = {
  readonly issues: ReadonlyArray<GitlabIssue>;
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
};

export const resolveIssueSessions = ({
  issues,
  sessions,
  sessionBranches,
  linkedSessions,
}: ResolveParams): Map<string, SessionId> =>
  sessionByExternalId({
    issues,
    sessions,
    linkedSessions,
    provider: 'gitlab',
    externalIdOf: ({ issue }) => String(issue.id),
    isSessionOfIssue: ({ issue, session }) => {
      const branch = sessionBranches[session.id];
      if (!branch) {
        return false;
      }
      return issueBranchMatches({ branch, prefix: String(issue.iid), title: issue.title });
    },
  });

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
  const beginFetch = useLatestFetch();

  const fetchIssues = useCallback(async () => {
    const isStale = beginFetch();
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
  }, [beginFetch, workspaceId, host, isEnabled]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions({ issues, sessions, sessionBranches, linkedSessions }),
    [issues, sessions, sessionBranches, linkedSessions],
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
