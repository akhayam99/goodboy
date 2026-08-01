import { useMemo, useState } from 'react';
import { EmptyState, ScrollFade, SectionHeader, SelectableRow, Skeleton } from '@goodboy/ui';
import { MessagesSquare, Search } from 'lucide-react';
import { issueIdentifier, type GitlabIssue } from '../client';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { GitlabIssueGroup } from './useGitlabIssues';

type Props = {
  readonly groups: ReadonlyArray<GitlabIssueGroup>;
  readonly focusedIssueId: number | null;
  readonly onSelect: (issue: GitlabIssue) => void;
  readonly loading: boolean;
  readonly error: string | null;
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
            issueIdentifier(r.issue).toLowerCase().includes(q) ||
            `#${r.issue.iid}`.includes(q) ||
            r.issue.title.toLowerCase().includes(q),
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
            aria-label="Search GitLab issues"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {loading && groups.length === 0 ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 pb-3"
          role="status"
          aria-label="Loading issues"
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-1.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-8 shrink-0 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-7 shrink-0 rounded" />
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
            icon={CONCEPT_ICONS.gitlab}
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
                        <SelectableRow
                          selected={active}
                          onClick={() => onSelect(row.issue)}
                          title={row.issue.title}
                          ariaCurrent={active}
                          className="items-center gap-2.5 px-2.5 py-2"
                        >
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full bg-provider-gitlab"
                          />
                          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                            #{row.issue.iid}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{row.issue.title}</span>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
                            {shortDate(row.issue.updatedAt)}
                          </span>
                          {row.sessionId ? (
                            <MessagesSquare
                              size={11}
                              aria-label="session launched"
                              className="shrink-0 text-success"
                            />
                          ) : null}
                        </SelectableRow>
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
