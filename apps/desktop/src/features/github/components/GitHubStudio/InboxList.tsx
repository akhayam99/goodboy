import { useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, EmptyState, ScrollFade, SectionHeader, SelectableRow } from '@goodboy/ui';
import { GitBranch, MessagesSquare, Plus, Search } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PullRequestChip } from '../PullRequestChip';
import type { InboxGroup } from './useGithubInbox';
import { InboxStatusIcons } from '../../../integrations/components/InboxStatusIcons';

type Props = {
  readonly groups: ReadonlyArray<InboxGroup>;
  readonly focusedSessionId: SessionId | null;
  readonly onSelect: (sessionId: SessionId) => void;
};

export const InboxList = ({ groups, focusedSessionId, onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter(
          (row) =>
            row.session.goal.toLowerCase().includes(q) ||
            (row.pr != null && `#${row.pr.number}`.includes(q)),
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groups, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-primary">
          <Search size={13} aria-hidden className="shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions…"
            aria-label="Search GitHub sessions"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            tone={CONCEPT_TONE.github}
            icon={CONCEPT_ICONS.github}
            title={hasQuery ? 'No matching sessions' : 'No sessions yet'}
            description={
              hasQuery
                ? 'Try a different search term.'
                : 'Sessions in this workspace will show up here.'
            }
            size="inline"
            action={
              hasQuery ? (
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
                >
                  <Plus size={13} aria-hidden />
                  New session
                </Button>
              )
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
                    const active = row.session.id === focusedSessionId;
                    return (
                      <li key={row.session.id}>
                        <SelectableRow
                          selected={active}
                          ariaCurrent={active}
                          onClick={() => onSelect(row.session.id)}
                          title={row.session.goal}
                          className="flex-col items-stretch gap-1 px-2.5 py-2"
                        >
                          <span className="flex items-center gap-2">
                            {row.pr ? (
                              <PullRequestChip state={row.pr.state} variant="icon" iconSize={12} />
                            ) : (
                              <GitBranch
                                size={12}
                                aria-hidden
                                className="shrink-0 text-muted-foreground/60"
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {row.session.goal}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
                            {row.pr ? (
                              <span className="shrink-0 tabular-nums text-muted-foreground/50">
                                #{row.pr.number}
                              </span>
                            ) : null}
                            {row.attention ? (
                              <span
                                aria-label="Needs attention"
                                title="Failing CI or changes requested"
                                className="size-1.5 shrink-0 rounded-full bg-danger"
                              />
                            ) : null}
                            <InboxStatusIcons
                              className="ml-auto"
                              sessionIcon={
                                <MessagesSquare
                                  size={11}
                                  aria-label="Session launched"
                                  className="text-success"
                                />
                              }
                              codeHostIcon={
                                row.pr != null ? (
                                  <CONCEPT_ICONS.github
                                    size={11}
                                    aria-label="GitHub pull request"
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
