import { memo, useMemo, useState } from 'react';
import {
  Archive,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  MessagesSquare,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, ScrollArea } from '@goodboy/ui';
import type { PullRequestStateKind, Session, SessionId } from '@goodboy/types';
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
          <span className="mb-1 mt-1 flex items-center justify-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
  const isPending = hasUnread && !isActive;
  const isRunning = session.state.kind === 'running';
  const isErrored = session.state.kind === 'error';
  const isAutoMode = session.autoRun === true;
  const spinBorder = isRunning ? (isAutoMode ? 'spin-border-danger' : 'spin-border-info') : null;
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
        'flex w-full flex-col items-center gap-1 rounded border px-1 py-2 text-center transition-colors',
        isActive
          ? 'border-border bg-muted text-foreground shadow-sm'
          : isRunning
            ? cn(
                'spin-border border-transparent text-foreground',
                spinBorder,
                isAutoMode ? 'bg-danger/5 hover:bg-danger/10' : 'bg-info/5 hover:bg-info/10',
              )
            : isPending
              ? 'animate-soft-pulse border-warning/70 bg-warning/5 text-foreground hover:bg-warning/10'
              : isErrored
                ? 'border-danger/40 bg-danger/5 text-foreground hover:bg-danger/10'
                : 'border-transparent text-foreground/70 hover:bg-muted/50 hover:text-foreground',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-1">
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
