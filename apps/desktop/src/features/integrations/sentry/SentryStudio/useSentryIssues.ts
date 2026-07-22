import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sentryFetchIssues, type SentryIssue } from '../client';

export type SentryIssueRow = {
  readonly issue: SentryIssue;
  readonly sessionId: SessionId | null;
};

export const dedupById = (issues: ReadonlyArray<SentryIssue>): SentryIssue[] => {
  const seen = new Set<string>();
  const out: SentryIssue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.id)) {
      continue;
    }
    seen.add(issue.id);
    out.push(issue);
  }
  return out;
};

export const resolveSentrySessions = (
  sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>,
): Map<string, SessionId> => {
  const byIssue = new Map<string, SessionId>();
  for (const [sessionId, tasks] of Object.entries(sessionExternalTasks)) {
    for (const task of tasks) {
      if (task.provider === 'sentry' && !byIssue.has(task.externalId)) {
        byIssue.set(task.externalId, sessionId as SessionId);
      }
    }
  }
  return byIssue;
};

export const buildIssueRows = (
  issues: ReadonlyArray<SentryIssue>,
  sessionIdByExternalId: ReadonlyMap<string, SessionId>,
): SentryIssueRow[] =>
  issues.map((issue) => ({
    issue,
    sessionId: sessionIdByExternalId.get(issue.id) ?? null,
  }));

export type UseSentryIssues = {
  readonly rows: ReadonlyArray<SentryIssueRow>;
  readonly loadMore: () => void;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useSentryIssues = (workspaceId: WorkspaceId): UseSentryIssues => {
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks);
  const [issues, setIssues] = useState<ReadonlyArray<SentryIssue>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor: string | null, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await sentryFetchIssues(workspaceId, undefined, nextCursor ?? undefined);
        setIssues((prev) => dedupById(reset ? page.issues : [...prev, ...page.issues]));
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor != null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    setIssues([]);
    setCursor(null);
    setHasMore(false);
    void load(null, true);
  }, [load]);

  const sessionIdByIssueId = useMemo(
    () => resolveSentrySessions(sessionExternalTasks),
    [sessionExternalTasks],
  );

  const rows = useMemo(
    () => buildIssueRows(issues, sessionIdByIssueId),
    [issues, sessionIdByIssueId],
  );

  const reload = useCallback(() => {
    setIssues([]);
    setCursor(null);
    setHasMore(false);
    void load(null, true);
  }, [load]);

  return {
    rows,
    loadMore: () => {
      if (!loading && cursor) {
        void load(cursor, false);
      }
    },
    hasMore,
    loading,
    error,
    refetch: reload,
  };
};
