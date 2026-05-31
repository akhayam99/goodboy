import { useMemo, useState } from 'react';
import { cn } from '@goodboy/ui';
import { GitPullRequest, Loader2, MessagesSquare, Search } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../client';
import type { LinearGroupKey, LinearIssueGroup } from './useLinearIssues';

interface Props {
  readonly groups: ReadonlyArray<LinearIssueGroup>;
  readonly focusedIssueId: string | null;
  readonly onSelect: (issue: LinearIssue) => void;
  readonly loading: boolean;
  readonly error: string | null;
}

const STATE_DOT: Record<LinearGroupKey, string> = {
  started: 'bg-primary',
  unstarted: 'bg-info',
  backlog: 'bg-muted-foreground/50',
  triage: 'bg-warning',
  other: 'bg-muted-foreground/40',
};

export function IssueInbox({ groups, focusedIssueId, onSelect, loading, error }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && groups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/60">
            <Loader2 size={16} className="animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-2xs leading-relaxed text-muted-foreground/70">
              {query.trim() ? 'No matching issues.' : 'No open issues assigned to you.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((group) => (
              <div key={group.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 px-1 pb-0.5">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {group.label}
                  </span>
                  <span className="text-2xs tabular-nums text-muted-foreground/50">
                    {group.rows.length}
                  </span>
                  <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
                </div>
                <ul className="flex flex-col gap-0.5">
                  {group.rows.map((row) => {
                    const active = row.issue.id === focusedIssueId;
                    return (
                      <li key={row.issue.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(row.issue)}
                          title={row.issue.title}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            active
                              ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn('size-2 shrink-0 rounded-full', STATE_DOT[group.key])}
                          />
                          <span className="shrink-0 font-mono text-2xs text-muted-foreground/70">
                            {row.issue.identifier}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{row.issue.title}</span>
                          {issuePullRequests(row.issue).length > 0 ? (
                            <GitPullRequest
                              size={11}
                              aria-label="has linked pull request"
                              className="shrink-0 text-muted-foreground/70"
                            />
                          ) : null}
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
        )}
      </div>
    </div>
  );
}
