import type { SessionId } from '@goodboy/types';
import { InlineMarkdown, STRIPED_LIST, cn, formatUsd } from '@goodboy/ui';
import { formatHours } from '../../utils/formatHours';
import type { ShippedSession } from '../../utils/shippedSessions';

type Props = {
  readonly sessions: ReadonlyArray<ShippedSession>;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

type MetaParams = {
  readonly session: ShippedSession;
};

const metaParts = ({ session }: MetaParams): ReadonlyArray<string> => [
  `${session.merged} ${session.merged === 1 ? 'PR' : 'PRs'} merged`,
  ...(session.spendUsd === null ? [] : [formatUsd(session.spendUsd)]),
  ...(session.hours === null ? [] : [formatHours({ hours: session.hours })]),
];

export const ShippedSessionRows = ({ sessions, onOpenSession }: Props) => (
  <ol className={cn('flex flex-col', STRIPED_LIST)}>
    {sessions.map((session, index) => (
      <li key={session.sessionId}>
        <button
          type="button"
          onClick={() => onOpenSession(session.sessionId)}
          className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-label motion-safe:transition-colors hover:bg-hover"
        >
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-success text-meta text-success"
          >
            {index + 1}
          </span>
          <InlineMarkdown text={session.goal} className="min-w-0 flex-1 truncate text-foreground" />
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {metaParts({ session }).join(' · ')}
          </span>
        </button>
      </li>
    ))}
  </ol>
);
