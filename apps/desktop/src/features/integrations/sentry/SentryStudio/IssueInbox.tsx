import { useMemo, useState } from 'react';
import { Button, cn, EmptyState, ScrollFade, SelectableRow, Skeleton } from '@goodboy/ui';
import { MessagesSquare, Search, Users } from 'lucide-react';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import type { SentryIssue } from '../client';
import { SentryLevelBadge } from '../SentryLevelBadge';
import type { SentryIssueRow } from './useSentryIssues';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { InboxStatusIcons } from '../../components/InboxStatusIcons';

type Props = {
  readonly rows: ReadonlyArray<SentryIssueRow>;
  readonly focusedIssueId: string | null;
  readonly onSelect: (issue: SentryIssue) => void;
  readonly onLoadMore: () => void;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
};

export const IssueInbox = ({
  rows,
  focusedIssueId,
  onSelect,
  onLoadMore,
  hasMore,
  loading,
  error,
  onRefresh,
}: Props) => {
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(
      (r) =>
        r.issue.title.toLowerCase().includes(q) ||
        (r.issue.culprit?.toLowerCase().includes(q) ?? false) ||
        (r.issue.shortId?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-primary">
          <Search size={13} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues…"
            aria-label="Search Sentry issues"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div
          role="status"
          aria-label="Loading issues"
          className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 pb-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-10 shrink-0 rounded" />
                <Skeleton className="h-3 min-w-0 flex-1 rounded" />
              </div>
              <Skeleton className="h-2.5 w-2/3 rounded" />
              <Skeleton className="h-2.5 w-1/3 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-3 pb-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.sentry}
            tone={CONCEPT_TONE.sentry}
            title={hasQuery ? 'No matching issues' : 'No issues'}
            description={
              hasQuery ? 'Try a different search term.' : 'No unresolved issues in this project.'
            }
            size="inline"
            action={
              <Button variant="ghost" size="sm" onClick={hasQuery ? () => setQuery('') : onRefresh}>
                {hasQuery ? 'Clear search' : 'Refresh'}
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <ul className="flex flex-col gap-0.5 px-3 pb-3">
            {filtered.map((row) => {
              const active = row.issue.id === focusedIssueId;
              const lastSeen = row.issue.lastSeen ? formatRelativeDuration(row.issue.lastSeen) : '';
              return (
                <li key={row.issue.id}>
                  <SelectableRow
                    selected={active}
                    onClick={() => onSelect(row.issue)}
                    title={row.issue.title}
                    ariaCurrent={active}
                    className="flex-col items-stretch gap-1 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <SentryLevelBadge level={row.issue.level} density="compact" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {row.issue.title}
                      </span>
                    </div>
                    {row.issue.culprit ? (
                      <span className="truncate font-mono text-2xs text-muted-foreground/70">
                        {row.issue.culprit}
                      </span>
                    ) : null}
                    <div className="flex items-center gap-2.5 text-2xs tabular-nums text-muted-foreground/60">
                      {row.issue.count ? <span>{row.issue.count} events</span> : null}
                      {row.issue.userCount != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Users size={9} aria-hidden />
                          {row.issue.userCount}
                        </span>
                      ) : null}
                      {lastSeen ? <span>{lastSeen}</span> : null}
                      <InboxStatusIcons
                        className="ml-auto"
                        sessionIcon={
                          row.sessionId != null ? (
                            <MessagesSquare
                              size={11}
                              aria-label="session launched"
                              className="text-success"
                            />
                          ) : null
                        }
                      />
                    </div>
                  </SelectableRow>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-md border border-border-soft py-2',
                  'text-2xs font-medium text-muted-foreground transition-colors',
                  'hover:border-border hover:bg-muted/40 hover:text-foreground disabled:opacity-50',
                  loading && 'animate-border-pulse',
                )}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </ScrollFade>
      )}
    </div>
  );
};
