import { useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  ScrollFade,
  SectionHeader,
  SelectableRow,
  Skeleton,
} from '@goodboy/ui';
import { GitMerge, Search } from 'lucide-react';
import type { GitlabMergeRequest } from '../client';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { GitlabMrGroup } from './useGitlabMrs';
import { InboxStatusIcons } from '../../components/InboxStatusIcons';

type Props = {
  readonly groups: ReadonlyArray<GitlabMrGroup>;
  readonly focusedMrId: number | null;
  readonly onSelect: (mr: GitlabMergeRequest) => void;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
};

type DateParams = {
  readonly iso: string;
};

const shortDate = ({ iso }: DateParams): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const MrInbox = ({ groups, focusedMrId, onSelect, loading, error, onRefresh }: Props) => {
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
          (mr) => `!${mr.iid}`.includes(normalized) || mr.title.toLowerCase().includes(normalized),
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
            placeholder="Search merge requests…"
            aria-label="Search GitLab merge requests"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
      {loading && groups.length === 0 ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-3"
          role="status"
          aria-label="Loading merge requests"
        >
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5 px-2.5 py-2">
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
            icon={CONCEPT_ICONS.gitlab}
            title={!hasQuery ? 'Inbox clear' : 'No matching merge requests'}
            description={
              !hasQuery ? 'No open merge requests assigned to you.' : 'Try a different search term.'
            }
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
                  {group.rows.map((mr) => {
                    const isActive = mr.id === focusedMrId;
                    return (
                      <li key={mr.id}>
                        <SelectableRow
                          selected={isActive}
                          onClick={() => onSelect(mr)}
                          title={mr.title}
                          ariaCurrent={isActive}
                          className="items-center gap-2.5 px-2.5 py-2"
                        >
                          <GitMerge
                            size={12}
                            aria-hidden
                            className="shrink-0 text-provider-gitlab"
                          />
                          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                            !{mr.iid}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{mr.title}</span>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
                            {shortDate({ iso: mr.updatedAt })}
                          </span>
                          <InboxStatusIcons
                            codeHostIcon={
                              <CONCEPT_ICONS.gitlab
                                size={11}
                                aria-label="GitLab merge request"
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
