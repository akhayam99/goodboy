import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessions } from '../../../../store';
import { jiraListIssues, type JiraIssue, type JiraStatusCategoryKey } from '../client';
import { useJiraConfig } from '../useJiraConfig';

const SLUG_MAX_LEN = 48;

type BranchSlugParams = {
  readonly issue: JiraIssue;
};

export const jiraBranchSlug = ({ issue }: BranchSlugParams): string =>
  `${issue.key.toLowerCase()}-${slugifyBranch({ input: issue.summary, maxLength: SLUG_MAX_LEN })}`;

export type JiraIssueRow = {
  readonly issue: JiraIssue;
  readonly sessionId: SessionId | null;
};

export type JiraIssueGroup = {
  readonly key: JiraStatusCategoryKey;
  readonly label: string;
  readonly rows: ReadonlyArray<JiraIssueRow>;
};

const GROUP_ORDER: ReadonlyArray<JiraStatusCategoryKey> = ['indeterminate', 'new', 'done', ''];

const GROUP_LABEL: Record<JiraStatusCategoryKey, string> = {
  indeterminate: 'In progress',
  new: 'To do',
  done: 'Done',
  '': 'Other',
};

type GroupParams = {
  readonly issues: ReadonlyArray<JiraIssue>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
};

export const buildIssueGroups = ({
  issues,
  sessionIdByExternalId,
}: GroupParams): ReadonlyArray<JiraIssueGroup> => {
  const buckets = new Map<JiraStatusCategoryKey, JiraIssueRow[]>();
  for (const issue of issues) {
    const row: JiraIssueRow = {
      issue,
      sessionId: sessionIdByExternalId.get(issue.id) ?? null,
    };
    const existing = buckets.get(issue.statusCategory);
    if (existing != null) {
      existing.push(row);
      continue;
    }
    buckets.set(issue.statusCategory, [row]);
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: GROUP_LABEL[key],
    rows: buckets
      .get(key)!
      .slice()
      .sort((left, right) => right.issue.updated.localeCompare(left.issue.updated)),
  }));
};

type SessionMatchParams = {
  readonly issues: ReadonlyArray<JiraIssue>;
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
};

const branchTail = (branch: string): string => {
  const lower = branch.toLowerCase();
  const index = lower.lastIndexOf('/');
  return index >= 0 ? lower.slice(index + 1) : lower;
};

export const resolveIssueSessions = ({
  issues,
  sessions,
  sessionBranches,
  sessionExternalTasks,
}: SessionMatchParams): Map<string, SessionId> => {
  const byIssue = new Map<string, SessionId>();
  for (const session of sessions) {
    const tasks = sessionExternalTasks[session.id] ?? [];
    for (const task of tasks) {
      if (task.provider === 'jira' && !byIssue.has(task.externalId)) {
        byIssue.set(task.externalId, session.id);
      }
    }
  }
  for (const issue of issues) {
    if (byIssue.has(issue.id)) {
      continue;
    }
    const slug = jiraBranchSlug({ issue });
    const match = sessions.find((session) => {
      const branch = sessionBranches[session.id];
      if (branch == null || branch === '') {
        return false;
      }
      return branchTail(branch) === slug;
    });
    if (match != null) {
      byIssue.set(issue.id, match.id);
    }
  }
  return byIssue;
};

export type UseJiraIssues = {
  readonly groups: ReadonlyArray<JiraIssueGroup>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

type HookParams = {
  readonly workspaceId: WorkspaceId;
  readonly isEnabled: boolean;
  readonly assignedOnly: boolean;
};

export const useJiraIssues = ({
  workspaceId,
  isEnabled,
  assignedOnly,
}: HookParams): UseJiraIssues => {
  const sessions = useSessions();
  const sessionExternalTasks = useAppStore((state) => state.sessionExternalTasks);
  const sessionBranches = useAppStore((state) => state.sessionBranches);
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const projectKey = config?.projectKey ?? null;
  const [issues, setIssues] = useState<ReadonlyArray<JiraIssue>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!isEnabled || siteUrl == null || email == null || projectKey == null) {
      setIssues([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const rows = await jiraListIssues({
        workspaceId,
        siteUrl,
        email,
        projectKey,
        assignedOnly,
      });
      setIssues(rows);
    } catch (fetchError) {
      setError(formatError(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, siteUrl, email, projectKey, assignedOnly, isEnabled]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const sessionIdByIssueId = useMemo(
    () => resolveIssueSessions({ issues, sessions, sessionBranches, sessionExternalTasks }),
    [issues, sessions, sessionBranches, sessionExternalTasks],
  );

  const groups = useMemo(
    () => buildIssueGroups({ issues, sessionIdByExternalId: sessionIdByIssueId }),
    [issues, sessionIdByIssueId],
  );

  return { groups, isLoading, error, refetch: () => void fetchIssues() };
};
