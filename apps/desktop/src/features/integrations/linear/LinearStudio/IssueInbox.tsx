import { useMemo, useState } from 'react';
import { cn, EmptyState, ScrollFade, SectionHeader, Skeleton } from '@goodboy/ui';
import { GitPullRequest, Inbox, MessagesSquare, Search } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../client';
import type { LinearGroupKey, LinearIssueGroup } from './useLinearIssues';

type Props = {
  readonly groups: ReadonlyArray<LinearIssueGroup>;
  readonly focusedIssueId: string | null;
  readonly onSelect: (issue: LinearIssue) => void;
  readonly loading: boolean;
  readonly error: string | null;
};

const STATE_DOT: Record<LinearGroupKey, string> = {
  started: 'bg-primary',
  unstarted: 'bg-info',
  backlog: 'bg-muted-foreground/50',
  triage: 'bg-warning',
  other: 'bg-muted-foreground/40',
};

export const IssueInbox = ({ groups, focusedIssueId, onSelect, loading, error }: Props) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return groups;
    }
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (r) =>
            r.issue.identifier.toLowerCase().includes(q) || r.issue.title.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [groups, query]);

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
            aria-label="Search Linear issues"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {loading && groups.length === 0 ? (
        <div role="status" aria-label="Loading issues" className="flex flex-col gap-1 px-3 pb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-1.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-12 shrink-0 rounded" />
              <Skeleton className="h-3 min-w-0 flex-1 rounded" />
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
            icon={Inbox}
            title={query.trim() ? 'No matching issues' : 'Inbox clear'}
            description={
              query.trim() ? 'Try a different search term.' : 'No open issues assigned to you.'
            }
          />
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {filtered.map((group) => (
              <div key={group.key} className="flex flex-col gap-1">
                <SectionHeader
                  className="px-1"
                  label={group.label}
                  action={
                    <span className="text-2xs tabular-nums text-muted-foreground/50">
                      {group.rows.length}
                    </span>
                  }
                />
                <ul className="flex flex-col gap-0.5">
                  {group.rows.map((row) => {
                    const active = row.issue.id === focusedIssueId;
                    return (
                      <li key={row.issue.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(row.issue)}
                          title={row.issue.title}
                          aria-current={active}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                            active
                              ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT[group.key])}
                          />
                          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                            {row.issue.identifier}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{row.issue.title}</span>
                          {issuePullRequests(row.issue).length > 0 && (
                            <GitPullRequest
                              size={11}
                              aria-label="has linked pull request"
                              className="shrink-0 text-muted-foreground/70"
                            />
                          )}
                          {row.sessionId ? (
                            <MessagesSquare
                              size={11}
                              aria-label="session launched"
                              className="shrink-0 text-success"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
