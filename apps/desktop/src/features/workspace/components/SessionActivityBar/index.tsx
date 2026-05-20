import { memo, useMemo, useState } from 'react';
import {
  Archive,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Inbox,
  MessagesSquare,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, ScrollArea } from '@kay-am/ui';
import type { PullRequestStateKind, Session, SessionId, TurnState } from '@kay-am/types';
import { useAppStore, useSessionHasUnread } from '../../../../store';
import { SESSION_STATUS_PALETTE } from '../../../../features/session/session-status';

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
          <span className="mb-1 flex items-center justify-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <MessagesSquare size={10} aria-hidden className="text-info" />
            Sessions
          </span>
          {displayList.map((session) => (
            <SessionActivityItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              dimmed={isArchivedView}
              onClick={() => onSelectSession(session.id as SessionId)}
            />
          ))}
          {!isArchivedView && (
            <button
              type="button"
              onClick={onNewSession}
              className="mt-0.5 flex w-full items-center justify-center gap-1 rounded border border-dashed border-border-soft py-2 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground"
              title="new session"
              aria-label="create new session"
            >
              <Plus size={12} aria-hidden />
              <span>New</span>
            </button>
          )}
          {isArchivedView && sortedArchived.length === 0 && (
            <p className="px-1 py-3 text-center text-[10px] text-muted-foreground/50">
              no archived sessions
            </p>
          )}
        </div>
      </ScrollArea>

      {/* archive toggle — single button at bottom */}
      <div className="shrink-0 p-1.5">
        <button
          type="button"
          onClick={() => setTab(isArchivedView ? 'active' : 'archived')}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-2xs font-medium transition-colors',
            isArchivedView
              ? 'bg-foreground/10 text-foreground'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
          )}
          title={isArchivedView ? 'show active sessions' : 'show archived sessions'}
        >
          {isArchivedView ? <Inbox size={11} aria-hidden /> : <Archive size={11} aria-hidden />}
          <span>{isArchivedView ? 'Active' : 'Archive'}</span>
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

const PR_ICON_MAP: Record<
  PullRequestStateKind,
  { icon: React.ElementType; label: string; className: string }
> = {
  draft: { icon: GitPullRequestDraft, label: 'draft', className: 'text-muted-foreground' },
  open: { icon: GitPullRequest, label: 'in review', className: 'text-success' },
  approved: { icon: GitPullRequest, label: 'approved', className: 'text-success' },
  merged: { icon: GitMerge, label: 'merged', className: 'text-merged' },
  closed: { icon: GitPullRequestClosed, label: 'closed', className: 'text-danger' },
};

const SessionActivityItem = memo(function SessionActivityItem({
  session,
  isActive,
  dimmed,
  onClick,
}: SessionActivityItemProps) {
  const hasUnread = useSessionHasUnread(session.id as SessionId);
  const showUnreadPing = hasUnread && !isActive;
  const dot = useSessionDot(session.state, showUnreadPing);
  const statusEntry = SESSION_STATUS_PALETTE[session.userStatus];
  const StatusIcon = statusEntry.icon;
  const prState = useAppStore((s) => s.sessionGithub[session.id as SessionId]?.pr?.state ?? null);
  const prEntry = prState ? PR_ICON_MAP[prState] : null;
  const PrIcon = prEntry?.icon ?? Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${session.goal} · ${statusEntry.label}${prEntry ? ` · PR ${prEntry.label}` : ''}`}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded px-1 py-2 text-center transition-colors',
        isActive
          ? 'bg-muted text-foreground shadow-sm'
          : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-1">
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
        <span className={cn('shrink-0', statusEntry.className)}>
          <StatusIcon size={10} aria-hidden />
        </span>
        <span className={cn('shrink-0', prEntry?.className ?? 'text-muted-foreground/30')}>
          <PrIcon size={10} aria-hidden />
        </span>
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
