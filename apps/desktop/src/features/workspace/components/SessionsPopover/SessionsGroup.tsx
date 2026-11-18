import { useId } from 'react';
import { Eyebrow } from '@goodboy/ui';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import { SessionsRow } from './SessionsRow';
import { sessionOptionId } from './sessionOptionId';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly sessions: ReadonlyArray<Session>;
  readonly offset: number;
  readonly activeIndex: number;
  readonly listId: string;
  readonly projectOf: Readonly<Record<string, string>>;
  readonly pinnedIds: ReadonlySet<string>;
  readonly onOpen: (sessionId: SessionId) => void;
  readonly onTogglePin: (sessionId: SessionId) => void;
};

export const SessionsGroup = ({
  label,
  count,
  sessions,
  offset,
  activeIndex,
  listId,
  projectOf,
  pinnedIds,
  onOpen,
  onTogglePin,
}: Props) => {
  const headId = useId();
  return (
    <div role="group" aria-labelledby={headId} className="flex flex-col">
      <div id={headId} className="flex items-baseline gap-2 px-3 pb-1 pt-2">
        <Eyebrow label={label} muted />
        <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
      </div>
      {sessions.map((session, index) => {
        const sessionId = brandId<SessionId>({ value: session.id });
        return (
          <SessionsRow
            key={session.id}
            session={session}
            optionId={sessionOptionId({ listId, index: offset + index })}
            project={projectOf[session.id] ?? ''}
            isActive={offset + index === activeIndex}
            isPinned={pinnedIds.has(session.id)}
            onOpen={() => onOpen(sessionId)}
            onTogglePin={() => onTogglePin(sessionId)}
          />
        );
      })}
    </div>
  );
};
