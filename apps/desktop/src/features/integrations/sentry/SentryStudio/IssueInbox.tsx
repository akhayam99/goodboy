import { useMemo, useState } from 'react';
import { cn, EmptyState } from '@goodboy/ui';
import { Inbox, Loader2, MessagesSquare, Search, Users } from 'lucide-react';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import type { SentryIssue } from '../client';
import type { SentryIssueRow } from './useSentryIssues';

type Props = {
  readonly rows: ReadonlyArray<SentryIssueRow>;
  readonly focusedIssueId: string | null;
  readonly onSelect: (issue: SentryIssue) => void;
  readonly onLoadMore: () => void;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
};

const LEVEL_TONE: Record<string, string> = {
  fatal: 'border-danger/40 bg-danger/10 text-danger',
  error: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
  debug: 'border-border-soft bg-muted/40 text-muted-foreground',
};

const levelTone = (level: string | null): string =>
  LEVEL_TONE[level?.toLowerCase() ?? ''] ?? 'border-border-soft bg-muted/40 text-muted-foreground';

export const IssueInbox = ({
  rows,
  focusedIssueId,
  onSelect,
  onLoadMore,
  hasMore,
  loading,
  error,
}: Props) => {
  const [query, setQuery] = useState('');

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
        <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground/60">
          <Loader2 size={16} className="animate-spin" aria-hidden />
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
            icon={Inbox}
            title={query.trim() ? 'No matching issues' : 'No issues'}
            description={
              query.trim()
                ? 'Try a different search term.'
                : 'No unresolved issues in this project.'
            }
          />
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1">
          <ul className="flex flex-col gap-0.5 px-3 pb-3">
            {filtered.map((row) => {
              const active = row.issue.id === focusedIssueId;
              const lastSeen = row.issue.lastSeen ? formatRelativeDuration(row.issue.lastSeen) : '';
              return (
                <li key={row.issue.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.issue)}
                    title={row.issue.title}
                    aria-current={active}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'shrink-0 rounded border px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide',
                          levelTone(row.issue.level),
                        )}
                      >
                        {row.issue.level ?? 'error'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {row.issue.title}
                      </span>
                      {row.sessionId ? (
                        <MessagesSquare
                          size={11}
                          aria-label="session launched"
                          className="shrink-0 text-success"
                        />
                      ) : null}
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
                      {lastSeen ? <span className="ml-auto">{lastSeen}</span> : null}
                    </div>
                  </button>
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
                )}
              >
                {loading ? <Loader2 size={12} className="animate-spin" aria-hidden /> : 'Load more'}
              </button>
            </div>
          ) : null}
        </ScrollFade>
      )}
    </div>
  );
};
