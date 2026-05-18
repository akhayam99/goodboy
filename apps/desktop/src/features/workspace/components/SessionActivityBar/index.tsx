import { memo, useMemo, useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import { cn, ScrollArea } from '@kay-am/ui';
import type { Session, SessionId, TurnState } from '@kay-am/types';
import { useSessionHasUnread } from '../../../../store';

type ActivityTab = 'active' | 'archived';

interface SessionActivityBarProps {
  sessions: ReadonlyArray<Session>;
  archivedSessions: ReadonlyArray<Session>;
  currentSessionId: SessionId | null;
  onSelectSession: (id: SessionId) => void;
  onNewSession: () => void;
}

export function SessionActivityBar({
  sessions,
  archivedSessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
}: SessionActivityBarProps) {
  const [tab, setTab] = useState<ActivityTab>('active');

  const sortedActive = useMemo(
    () => [...sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [sessions],
  );
  const sortedArchived = useMemo(
    () => [...archivedSessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [archivedSessions],
  );

  const displayList = tab === 'active' ? sortedActive : sortedArchived;

  return (
    <div className="flex w-20 shrink-0 flex-col rounded-lg bg-muted/40 m-1 mr-0">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1">
          {displayList.map((session) => (
            <SessionActivityItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              dimmed={tab === 'archived'}
              onClick={() => onSelectSession(session.id as SessionId)}
            />
          ))}
          {tab === 'active' && (
            <button
              type="button"
              onClick={onNewSession}
              className="mt-0.5 flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
              title="new session"
              aria-label="create new session"
            >
              <Plus size={13} aria-hidden />
            </button>
          )}
          {tab === 'archived' && sortedArchived.length === 0 && (
            <p className="px-1 py-3 text-center text-[10px] text-muted-foreground/50">
              no archived sessions
            </p>
          )}
        </div>
      </ScrollArea>

      {/* segment control */}
      <div className="shrink-0 p-1">
        <div className="flex rounded-md bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={cn(
              'flex flex-1 items-center justify-center rounded py-1 text-[10px] font-medium transition-colors',
              tab === 'active'
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-muted-foreground',
            )}
            title="active sessions"
          >
            {sortedActive.length}
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={cn(
              'flex flex-1 items-center justify-center gap-0.5 rounded py-1 text-[10px] font-medium transition-colors',
              tab === 'archived'
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-muted-foreground',
            )}
            title="archived sessions"
          >
            <Archive size={9} aria-hidden />
            {sortedArchived.length}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SessionActivityItemProps {
  session: Session;
  isActive: boolean;
  dimmed?: boolean;
  onClick: () => void;
}

const SessionActivityItem = memo(function SessionActivityItem({
  session,
  isActive,
  dimmed,
  onClick,
}: SessionActivityItemProps) {
  const hasUnread = useSessionHasUnread(session.id as SessionId);
  const showUnreadPing = hasUnread && !isActive;
  const dot = useSessionDot(session.state, showUnreadPing);

  return (
    <button
      type="button"
      onClick={onClick}
      title={session.goal}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {dot.ping && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              dot.pingColor,
            )}
          />
        )}
        <span className={cn('relative inline-block h-2 w-2 rounded-full', dot.color)} />
      </span>
      <span className="line-clamp-2 w-full text-[10px] leading-tight">{session.goal}</span>
    </button>
  );
});

function useSessionDot(
  state: TurnState,
  hasUnread: boolean,
): { color: string; ping: boolean; pingColor: string } {
  if (state.kind === 'running') {
    return { color: 'bg-info', ping: true, pingColor: 'bg-info' };
  }
  if (hasUnread) {
    return { color: 'bg-warning', ping: true, pingColor: 'bg-warning' };
  }
  if (state.kind === 'error') {
    return { color: 'bg-danger', ping: false, pingColor: '' };
  }
  if (state.kind === 'ended') {
    return { color: 'bg-muted-foreground', ping: false, pingColor: '' };
  }
  return { color: 'bg-muted-foreground/30', ping: false, pingColor: '' };
}
