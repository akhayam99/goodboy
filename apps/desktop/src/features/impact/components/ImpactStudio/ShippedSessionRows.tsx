import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { InlineMarkdown, STRIPED_LIST, cn, formatUsd } from '@goodboy/ui';
import { formatHours } from '../../utils/formatHours';
import type { ShippedSession } from '../../utils/shippedSessions';
import { DeletedSessionTag } from '../../../../shared/components/DeletedSessionTag';

type Props = {
  readonly sessions: ReadonlyArray<ShippedSession>;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

type MetaParams = {
  readonly session: ShippedSession;
};

const ROW = 'flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-label';

const metaParts = ({ session }: MetaParams): ReadonlyArray<string> => [
  `${session.merged} ${session.merged === 1 ? 'PR' : 'PRs'} merged`,
  ...(session.spendUsd === null ? [] : [formatUsd(session.spendUsd)]),
  ...(session.hours === null ? [] : [formatHours({ hours: session.hours })]),
];

type ContentParams = {
  readonly session: ShippedSession;
  readonly rank: number;
};

const rowContent = ({ session, rank }: ContentParams): ReactNode => (
  <>
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-success text-meta text-success"
    >
      {rank}
    </span>
    <InlineMarkdown text={session.goal} className="min-w-0 flex-1 truncate text-foreground" />
    {session.isDeleted ? <DeletedSessionTag /> : null}
    <span className="shrink-0 tabular-nums text-muted-foreground">
      {metaParts({ session }).join(' · ')}
    </span>
  </>
);

export const ShippedSessionRows = ({ sessions, onOpenSession }: Props) => (
  <ol className={cn('flex flex-col', STRIPED_LIST)}>
    {sessions.map((session, index) => (
      <li key={session.sessionId}>
        {session.isDeleted ? (
          <div className={ROW}>{rowContent({ session, rank: index + 1 })}</div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenSession(session.sessionId)}
            className={cn(ROW, 'motion-safe:transition-colors hover:bg-hover')}
          >
            {rowContent({ session, rank: index + 1 })}
          </button>
        )}
      </li>
    ))}
  </ol>
);
