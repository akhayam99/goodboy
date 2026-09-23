import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { sentryFetchIssues, type SentryIssue } from '../client';
import { linkedTaskKey, useLinkedExternalIds } from '../../hooks/useLinkedExternalIds';

const SENTRY_PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = ['sentry'];

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

export const buildIssueRows = (
  issues: ReadonlyArray<SentryIssue>,
  linkedSessions: ReadonlyMap<string, SessionId>,
): SentryIssueRow[] =>
  issues.map((issue) => ({
    issue,
    sessionId:
      linkedSessions.get(linkedTaskKey({ provider: 'sentry', externalId: issue.id })) ?? null,
  }));

export type UseSentryIssues = {
  readonly rows: ReadonlyArray<SentryIssueRow>;
  readonly loadMore: () => void;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

export const useSentryIssues = (workspaceId: WorkspaceId, isEnabled = true): UseSentryIssues => {
  const linkedSessions = useLinkedExternalIds({ providers: SENTRY_PROVIDERS });
  const [issues, setIssues] = useState<ReadonlyArray<SentryIssue>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor: string | null, reset: boolean) => {
      if (!isEnabled) {
        setIssues([]);
        setCursor(null);
        setHasMore(false);
        setLoading(false);
        setError(null);
        return;
      }
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
    [isEnabled, workspaceId],
  );

  useEffect(() => {
    setIssues([]);
    setCursor(null);
    setHasMore(false);
    void load(null, true);
  }, [load]);

  const rows = useMemo(() => buildIssueRows(issues, linkedSessions), [issues, linkedSessions]);

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
