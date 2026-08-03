import type { SessionId } from '@goodboy/types';
import { Button, EmptyState, Eyebrow, SelectableRow } from '@goodboy/ui';
import { GitBranch, MessagesSquare, Plus } from 'lucide-react';
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
  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-3">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.github}
          icon={CONCEPT_ICONS.github}
          title="No sessions yet"
          description="Sessions in this workspace will show up here."
          size="inline"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
            >
              <Plus size={13} aria-hidden />
              New session
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 px-1 pb-0.5">
            <Eyebrow label={group.label} />
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
                  <SelectableRow
                    selected={active}
                    ariaCurrent={active}
                    onClick={() => onSelect(row.session.id)}
                    title={row.session.goal}
                    className="items-center gap-1.5 px-2 py-1.5"
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
                      <span className="shrink-0 text-3xs tabular-nums text-muted-foreground/50">
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
                    <InboxStatusIcons
                      sessionIcon={
                        <MessagesSquare
                          size={11}
                          aria-label="session launched"
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
                  </SelectableRow>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
