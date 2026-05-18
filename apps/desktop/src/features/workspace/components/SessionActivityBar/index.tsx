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

  return (
    <div className="flex w-28 shrink-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col px-1.5 py-1.5">
          <span className="mb-1 flex items-center justify-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <MessagesSquare size={10} aria-hidden className="text-info" />
            Sessions
          </span>
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
              className="mt-0.5 flex w-full items-center justify-center rounded py-1.5 text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
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
      <div className="shrink-0 p-1.5">
        <div className="flex rounded p-0.5">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={cn(
              'flex flex-1 items-center justify-center rounded py-1.5 transition-colors',
              tab === 'active'
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="active sessions"
          >
            <Inbox size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={cn(
              'flex flex-1 items-center justify-center rounded py-1.5 transition-colors',
              tab === 'archived'
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="archived sessions"
          >
            <Archive size={12} aria-hidden />
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
      title={`${session.goal} — ${statusEntry.label}${prEntry ? ` · PR ${prEntry.label}` : ''}`}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded px-1 py-2 text-center transition-colors',
        isActive
          ? 'bg-background text-foreground shadow-sm dark:bg-muted'
          : 'text-foreground/70 hover:bg-background/50 hover:text-foreground',
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
