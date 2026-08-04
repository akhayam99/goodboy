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
import type { GithubIssue } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { formatShortDayMonth } from '../../../../shared/utils/formatShortDayMonth';
import type { GithubIssueGroup } from './useGithubIssues';
import { InboxStatusIcons } from '../../../integrations/components/InboxStatusIcons';

type Props = {
  readonly groups: ReadonlyArray<GithubIssueGroup>;
  readonly focusedIssueNumber: number | null;
  readonly onSelect: (issue: GithubIssue) => void;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
};

export const IssueInbox = ({
  groups,
  focusedIssueNumber,
  onSelect,
  loading,
  error,
  onRefresh,
}: Props) => {
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === '') {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter(
          (row) =>
            `#${row.issue.number}`.includes(normalized) ||
            row.issue.title.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groups, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-primary">
          <Search size={13} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search issues…"
            aria-label="Search GitHub issues"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
      {loading && groups.length === 0 ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-3"
          role="status"
          aria-label="Loading issues"
        >
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-1.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-8 shrink-0 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
            </div>
          ))}
        </div>
      ) : error != null ? (
        <div className="px-3 pb-3">
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.github}
            tone={CONCEPT_TONE.github}
            title={!hasQuery ? 'Inbox clear' : 'No matching issues'}
            description={
              !hasQuery ? 'No open issues assigned to you.' : 'Try a different search term.'
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
                    const isActive = row.issue.number === focusedIssueNumber;
                    return (
                      <li key={row.issue.number}>
                        <SelectableRow
                          selected={isActive}
                          onClick={() => onSelect(row.issue)}
                          title={row.issue.title}
                          ariaCurrent={isActive}
                          className="items-center gap-2.5 px-2.5 py-2"
                        >
                          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                            #{row.issue.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{row.issue.title}</span>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
                            {formatShortDayMonth({ iso: row.issue.updatedAt })}
                          </span>
                          <InboxStatusIcons
                            sessionIcon={
                              row.sessionId != null ? (
                                <MessagesSquare
                                  size={11}
                                  aria-label="Session launched"
                                  className="text-success"
                                />
                              ) : null
                            }
                            codeHostIcon={
                              <CONCEPT_ICONS.github
                                size={11}
                                aria-label="GitHub issue"
                                className="text-muted-foreground/70"
                              />
                            }
                          />
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
