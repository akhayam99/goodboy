import type { SessionId } from '@goodboy/types';
import { cn, EmptyState } from '@goodboy/ui';
import { GitBranch, Inbox } from 'lucide-react';
import { PullRequestChip } from '../PullRequestChip';
import type { InboxGroup } from './useGithubInbox';

type Props = {
  readonly groups: ReadonlyArray<InboxGroup>;
  readonly focusedSessionId: SessionId | null;
  readonly onSelect: (sessionId: SessionId) => void;
};

export const InboxList = ({ groups, focusedSessionId, onSelect }: Props) => {
  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-3">
        <EmptyState
          icon={Inbox}
          title="No sessions yet"
          description="Sessions in this workspace will show up here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {groups.map((group) => (
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
              const active = row.session.id === focusedSessionId;
              return (
                <li key={row.session.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.session.id)}
                    title={row.session.goal}
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {row.pr ? (
                      <PullRequestChip state={row.pr.state} variant="icon" iconSize={12} />
                    ) : (
                      <GitBranch
                        size={12}
                        aria-hidden
                        className="shrink-0 text-muted-foreground/60"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs">{row.session.goal}</span>
                    {row.pr ? (
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                        #{row.pr.number}
                      </span>
                    ) : null}
                    {row.attention ? (
                      <span
                        aria-label="needs attention"
                        title="failing CI or changes requested"
                        className="size-1.5 shrink-0 rounded-full bg-danger"
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
  );
};
