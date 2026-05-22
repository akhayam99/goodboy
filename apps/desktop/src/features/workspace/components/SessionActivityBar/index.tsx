import { memo, useMemo, useState } from 'react';
import { Archive, MessagesSquare, Plus } from 'lucide-react';
import { cn, ScrollArea } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionHasUnread } from '../../../../store';
import { SESSION_STATUS_PALETTE } from '../../../../features/session/session-status';
import {
  PullRequestChip,
  pullRequestMeta,
} from '../../../../features/github/components/PullRequestChip';

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

  const isArchivedView = tab === 'archived';

  return (
    <div className="flex h-full w-28 shrink-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-1.5 py-1.5">
          <span className="mb-1 mt-1 flex items-center justify-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <MessagesSquare size={10} aria-hidden className="text-info" />
            Sessions
          </span>
          {/* "New session" lives at the top — never moves, always discoverable.
              Hidden in the archived view because creating from a filter would
              flip the user back to active anyway. */}
          {!isArchivedView && (
            <button
              type="button"
              onClick={onNewSession}
              className="mb-0.5 flex w-full items-center justify-center gap-1 rounded border border-dashed border-border-soft bg-muted/30 py-2 text-[10px] font-medium text-muted-foreground/80 transition-colors hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground"
              title="new session"
              aria-label="create new session"
            >
              <Plus size={12} aria-hidden />
              <span>New</span>
            </button>
          )}
          {displayList.map((session) => (
            <SessionActivityItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              dimmed={isArchivedView}
              onClick={() => onSelectSession(session.id as SessionId)}
            />
          ))}
          {!isArchivedView && displayList.length === 0 && (
            <p className="px-1 py-3 text-center text-[10px] leading-snug text-muted-foreground/50">
              No sessions yet.
            </p>
          )}
          {isArchivedView && sortedArchived.length === 0 && (
            <p className="px-1 py-3 text-center text-[10px] text-muted-foreground/50">
              no archived sessions
            </p>
          )}
        </div>
      </ScrollArea>

      {/* archive toggle — single button at bottom; label stays fixed,
          colour signals whether the archived view is currently open. */}
      <div className="shrink-0 p-1.5">
        <button
          type="button"
          onClick={() => setTab(isArchivedView ? 'active' : 'archived')}
          aria-pressed={isArchivedView}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded border py-1.5 text-2xs font-medium transition-colors',
            isArchivedView
              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
          )}
          title={isArchivedView ? 'hide archived sessions' : 'show archived sessions'}
        >
          <Archive size={11} aria-hidden />
          <span>Archived</span>
        </button>
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
  const isPending = hasUnread && !isActive;
  const isRunning = session.state.kind === 'running';
  const isErrored = session.state.kind === 'error';
  const isAutoMode = session.autoRun === true;
  const spinBorder = isRunning ? (isAutoMode ? 'spin-border-danger' : 'spin-border-info') : null;
  const statusEntry = SESSION_STATUS_PALETTE[session.userStatus];
  const StatusIcon = statusEntry.icon;
  const prState = useAppStore((s) => s.sessionGithub[session.id as SessionId]?.pr?.state ?? null);
  const prMeta = prState ? pullRequestMeta(prState) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${session.goal} · ${statusEntry.label}${prMeta ? ` · PR ${prMeta.label}` : ''}`}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded border px-1 py-2 text-center transition-colors',
        // base surface — selected vs unselected
        isActive
          ? 'bg-elevated text-foreground shadow-sm'
          : 'bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground',
        // State border — only when the session is NOT the active one.
        // Once you're sitting inside the session the badges/spinners up
        // top become redundant; the active tile collapses back to a
        // plain selected border so the rail doesn't double-shout.
        isActive
          ? 'border-border'
          : isRunning
            ? cn('spin-border border-transparent', spinBorder)
            : isPending
              ? 'animate-border-pulse border-warning/70'
              : isErrored
                ? 'border-danger/40'
                : 'border-transparent',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-1">
        <span className={cn('shrink-0', statusEntry.className)}>
          <StatusIcon size={10} aria-hidden />
        </span>
        {prState ? (
          <PullRequestChip state={prState} variant="icon" iconSize={10} />
        ) : (
          <span className="inline-flex size-2.5 shrink-0" aria-hidden />
        )}
      </span>
      <span className="line-clamp-2 w-full text-[10px] leading-tight">{session.goal}</span>
    </button>
  );
});
