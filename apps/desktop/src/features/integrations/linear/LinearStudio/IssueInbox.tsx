import { useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  ScrollFade,
  SectionHeader,
  SelectableRow,
  Skeleton,
} from '@goodboy/ui';
import { MessagesSquare, Search } from 'lucide-react';
import { issuePullRequests, type LinearIssue } from '../client';
import { LinearPriority } from '../LinearPriority';
import type { LinearIssueGroup } from './useLinearIssues';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { InboxStatusIcons } from '../../components/InboxStatusIcons';

type Props = {
  readonly groups: ReadonlyArray<LinearIssueGroup>;
  readonly focusedIssueId: string | null;
  readonly onSelect: (issue: LinearIssue) => void;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
};

export const IssueInbox = ({
  groups,
  focusedIssueId,
  onSelect,
  loading,
  error,
  onRefresh,
}: Props) => {
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';

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
        <div
          role="status"
          aria-label="Loading issues"
          className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-3"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-1.5 shrink-0 rounded-full" />
                <Skeleton className="h-3 min-w-0 flex-1 rounded" />
              </div>
              <Skeleton className="h-2.5 w-16 rounded" />
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
            icon={CONCEPT_ICONS.linear}
            tone={CONCEPT_TONE.linear}
            title={hasQuery ? 'No matching issues' : 'Inbox clear'}
            description={
              hasQuery ? 'Try a different search term.' : 'No open issues assigned to you.'
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
                    const linkedPullRequest = issuePullRequests(row.issue)[0] ?? null;
                    const CodeHostIcon = linkedPullRequest?.url.includes('/merge_requests/')
                      ? CONCEPT_ICONS.gitlab
                      : CONCEPT_ICONS.github;
                    return (
                      <li key={row.issue.id}>
                        <SelectableRow
                          selected={active}
                          onClick={() => onSelect(row.issue)}
                          title={row.issue.title}
                          ariaCurrent={active}
                          className="flex-col items-stretch gap-1 px-2.5 py-2"
                        >
                          <span className="flex items-center gap-2">
                            <LinearPriority
                              appearance="dot"
                              priority={row.issue.priority}
                              priorityLabel={row.issue.priorityLabel}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {row.issue.title}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
                            <span className="shrink-0 font-mono tabular-nums">
                              {row.issue.identifier}
                            </span>
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
                              codeHostIcon={
                                linkedPullRequest != null ? (
                                  <CodeHostIcon
                                    size={11}
                                    aria-label="has linked pull request"
                                    className="text-muted-foreground/70"
                                  />
                                ) : null
                              }
                            />
                          </span>
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
