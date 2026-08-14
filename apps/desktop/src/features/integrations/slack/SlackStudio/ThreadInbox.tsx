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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '@goodboy/ui';
import { formatAdaptiveAge } from '../../../../shared/utils/relativeDate';
import { InboxStatusIcons } from '../../components/InboxStatusIcons';
import { slackThreadFirstLine } from '../threadFormulas';
import type { SlackThreadGroup, SlackThreadRow } from './useSlackThreads';

type Props = {
  readonly groups: ReadonlyArray<SlackThreadGroup>;
  readonly focusedThreadTs: string | null;
  readonly onSelect: (row: SlackThreadRow) => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly hiddenChannelCount: number;
};

export const ThreadInbox = ({
  groups,
  focusedThreadTs,
  onSelect,
  isLoading,
  error,
  onRefresh,
  hiddenChannelCount,
}: Props) => {
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter(
          (row) =>
            row.channel.name.toLowerCase().includes(needle) ||
            row.head.text.toLowerCase().includes(needle),
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
            placeholder="Search threads…"
            aria-label="Search Slack threads"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {isLoading && groups.length === 0 ? (
        <div
          className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 pb-3"
          role="status"
          aria-label="Loading threads"
        >
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-1.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-7 shrink-0 rounded" />
            </div>
          ))}
        </div>
      ) : error != null ? (
        <div className="px-3 pb-3">
          <ErrorStrip label="threads" error={new Error(error)} onRetry={onRefresh} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.slack}
            tone={CONCEPT_TONE.slack}
            title={hasQuery ? 'No matching threads' : 'No channels yet'}
            description={
              hasQuery
                ? 'Try a different search term.'
                : 'Invite the bot to a public channel in Slack and it shows up here. Goodboy only sees channels the bot has joined.'
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
                    const threadTs = row.head.threadTs ?? row.head.ts;
                    const isActive = threadTs === focusedThreadTs;
                    const preview = slackThreadFirstLine({ text: row.head.text });
                    return (
                      <li key={threadTs}>
                        <SelectableRow
                          selected={isActive}
                          onClick={() => onSelect(row)}
                          title={preview}
                          ariaCurrent={isActive}
                          className="items-center gap-2.5 px-2.5 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {preview !== '' ? preview : 'Untitled thread'}
                          </span>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
                            {row.head.latestReplyAt != null
                              ? formatAdaptiveAge({ iso: row.head.latestReplyAt })
                              : ''}
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
                              <CONCEPT_ICONS.slack
                                size={11}
                                aria-label="Slack thread"
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
            {hiddenChannelCount > 0 && (
              <p className="px-1 text-2xs text-muted-foreground/60">
                {`${hiddenChannelCount} more channels the bot joined are not read here, and each channel only reads its latest 200 messages.`}
              </p>
            )}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
