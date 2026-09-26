import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, InlineMarkdown, STRIPED_LIST, cn, formatUsd } from '@goodboy/ui';
import type { SessionSpend } from '../../../budget/components/spend/lib';

type Props = {
  readonly sessions: ReadonlyArray<SessionSpend>;
  readonly onSelectSession: (sessionId: SessionId) => void;
};

const VISIBLE_ROWS = 5;

export const SessionSpendRows = ({ sessions, onSelectSession }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visible = isExpanded ? sessions : sessions.slice(0, VISIBLE_ROWS);
  const hidden = sessions.length - visible.length;
  return (
    <div className="flex flex-col gap-2">
      <ol className={cn('flex flex-col', STRIPED_LIST)}>
        {visible.map((session) => (
          <li key={session.sessionId}>
            <button
              type="button"
              onClick={() => onSelectSession(session.sessionId)}
              className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-label motion-safe:transition-colors hover:bg-hover"
            >
              <InlineMarkdown
                text={session.goal}
                className="min-w-0 flex-1 truncate text-foreground"
              />
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {session.turnCount} {session.turnCount === 1 ? 'turn' : 'turns'}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-foreground">
                {formatUsd(session.spentUsd)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {hidden > 0 ? (
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)}>
            Show all {sessions.length}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
