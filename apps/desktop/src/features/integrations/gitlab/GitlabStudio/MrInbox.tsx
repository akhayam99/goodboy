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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { formatAdaptiveAge } from '../../../../shared/utils/relativeDate';
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
            <div key={index} className="flex flex-col gap-1.5 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 shrink-0 rounded" />
                <Skeleton className="h-3 flex-1 rounded" />
              </div>
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          ))}
        </div>
      ) : error != null ? (
        <div className="px-3 pb-3">
          <ErrorStrip label="merge requests" error={new Error(error)} onRetry={onRefresh} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.gitlab}
            tone={CONCEPT_TONE.gitlab}
            title={!hasQuery ? 'Inbox clear' : 'No matching merge requests'}
            description={
              !hasQuery ? 'No open merge requests assigned to you.' : 'Try a different search term.'
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
                  {group.rows.map((mr) => {
                    const isActive = mr.id === focusedMrId;
                    return (
                      <li key={mr.id}>
                        <SelectableRow
                          selected={isActive}
                          onClick={() => onSelect(mr)}
                          title={mr.title}
                          ariaCurrent={isActive}
                          className="flex-col items-stretch gap-1 px-2.5 py-2"
                        >
                          <span className="flex items-center gap-2">
                            <GitMerge
                              size={12}
                              aria-hidden
                              className="shrink-0 text-provider-gitlab"
                            />
                            <span className="min-w-0 flex-1 truncate text-xs">{mr.title}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
                            <span className="shrink-0 font-mono tabular-nums">!{mr.iid}</span>
                            <span aria-hidden className="text-muted-foreground/40">
                              ·
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground/50">
                              {formatAdaptiveAge({ iso: mr.updatedAt })}
                            </span>
                            <InboxStatusIcons
                              className="ml-auto"
                              codeHostIcon={
                                <CONCEPT_ICONS.gitlab
                                  size={11}
                                  aria-label="GitLab merge request"
                                  className="text-muted-foreground/70"
                                />
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
