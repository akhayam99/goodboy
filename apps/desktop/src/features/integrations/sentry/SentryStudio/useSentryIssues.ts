import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { sentryFetchIssues, type SentryIssue, type SentryIssuesPage } from '../client';
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

const NO_LINKED_PROJECTS: ReadonlyArray<string> = [];

const EMPTY_PAGE: SentryIssuesPage = { issues: [], next_cursor: null };

export const useSentryIssues = (
  workspaceId: WorkspaceId,
  isEnabled = true,
  linkedProjects: ReadonlyArray<string> = NO_LINKED_PROJECTS,
  isReady = true,
): UseSentryIssues => {
  const linkedKey = [...new Set(linkedProjects)].sort().join('\n');
  const linkedSessions = useLinkedExternalIds({ providers: SENTRY_PROVIDERS });
  const [issues, setIssues] = useState<ReadonlyArray<SentryIssue>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(
    async (nextCursor: string | null, reset: boolean) => {
      const current = generation.current + 1;
      generation.current = current;
      const isStale = (): boolean => generation.current !== current;
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
      if (!isReady) {
        return;
      }
      try {
        const extraSlugs = reset && linkedKey !== '' ? linkedKey.split('\n') : [];
        const [page, ...extraPages] = await Promise.all([
          sentryFetchIssues(workspaceId, undefined, nextCursor ?? undefined),
          ...extraSlugs.map((slug) =>
            sentryFetchIssues(workspaceId, undefined, undefined, undefined, slug).catch(
              () => EMPTY_PAGE,
            ),
          ),
        ]);
        if (isStale()) {
          return;
        }
        const fetched = [...page.issues, ...extraPages.flatMap((extra) => extra.issues)];
        setIssues((prev) => dedupById(reset ? fetched : [...prev, ...fetched]));
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor != null);
        setLoading(false);
      } catch (err) {
        if (isStale()) {
          return;
        }
        setError(formatError(err));
        setLoading(false);
      }
    },
    [isEnabled, isReady, linkedKey, workspaceId],
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
