import { useState, type ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, InlineMarkdown, STRIPED_LIST, cn, formatUsd } from '@goodboy/ui';
import { DeletedSessionTag } from '../../../../shared/components/DeletedSessionTag';
import type { SessionSpend } from '../../../budget/components/spend/lib';

type Props = {
  readonly sessions: ReadonlyArray<SessionSpend>;
  readonly onSelectSession: (sessionId: SessionId) => void;
};

type ContentParams = {
  readonly session: SessionSpend;
};

const VISIBLE_ROWS = 5;

const ROW = 'flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-label';

const rowContent = ({ session }: ContentParams): ReactNode => (
  <>
    <InlineMarkdown text={session.goal} className="min-w-0 flex-1 truncate text-foreground" />
    {session.isDeleted ? <DeletedSessionTag /> : null}
    <span className="shrink-0 tabular-nums text-muted-foreground">
      {session.turnCount} {session.turnCount === 1 ? 'turn' : 'turns'}
    </span>
    <span className="w-16 shrink-0 text-right tabular-nums text-foreground">
      {formatUsd(session.spentUsd)}
    </span>
  </>
);

export const SessionSpendRows = ({ sessions, onSelectSession }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visible = isExpanded ? sessions : sessions.slice(0, VISIBLE_ROWS);
  const hidden = sessions.length - visible.length;
  return (
    <div className="flex flex-col gap-2">
      <ol className={cn('flex flex-col', STRIPED_LIST)}>
        {visible.map((session) => (
          <li key={session.sessionId}>
            {session.isDeleted ? (
              <div className={ROW}>{rowContent({ session })}</div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectSession(session.sessionId)}
                className={cn(ROW, 'motion-safe:transition-colors hover:bg-hover')}
              >
                {rowContent({ session })}
              </button>
            )}
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
