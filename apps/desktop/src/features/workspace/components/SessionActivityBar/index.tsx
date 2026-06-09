import { Fragment, memo, useMemo, useState } from 'react';
import { Archive, Loader2, Plus } from 'lucide-react';
import { Button, cn, ScrollArea } from '@goodboy/ui';
import type {
  Session,
  SessionGroupKey,
  SessionId,
  TelemetryRecord,
  WorkspaceId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionHasUnread,
  useSessionViewPrefs,
  useSortedGroupedSessions,
} from '../../../../store';
import { SESSION_STATUS_PALETTE } from '../../../../features/session/session-status';
import { CostBadge } from '../../../../features/providers/components/CostBadge';
import {
  PullRequestChip,
  pullRequestMeta,
} from '../../../../features/github/components/PullRequestChip';
import { SessionViewMenu } from './SessionViewMenu';

type ActivityTab = 'active' | 'archived';

const USER_STATUS_GROUP_LABELS: Record<string, string> = {
  wip: 'in progress',
  waiting: 'waiting',
  blocked: 'blocked',
  done: 'done',
};

const PR_GROUP_LABELS: Record<string, string> = {
  'not-open': 'no PR',
  draft: 'draft',
  reviewable: 'in review',
  reviewed: 'approved',
  closed: 'closed',
  merged: 'merged',
};

function groupLabel(key: string, groupMode: SessionGroupKey): string {
  if (groupMode === 'userStatus') {
    return USER_STATUS_GROUP_LABELS[key] ?? key;
  }
  if (groupMode === 'pr') {
    return PR_GROUP_LABELS[key] ?? key;
  }
  return key;
}

type SessionActivityBarProps = {
  workspaceId: WorkspaceId;
  sessions: ReadonlyArray<Session>;
  archivedSessions: ReadonlyArray<Session>;
  currentSessionId: SessionId | null;
  onSelectSession: (id: SessionId) => void;
  onNewSession: () => void;
  onArchivedTabOpen?: () => void;
};

export const SessionActivityBar = ({
  workspaceId,
  sessions,
  archivedSessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onArchivedTabOpen,
}: SessionActivityBarProps) => {
  const [tab, setTab] = useState<ActivityTab>('active');

  const prefs = useSessionViewPrefs(workspaceId);

  const groupedActive = useSortedGroupedSessions(workspaceId, sessions);
  const groupedArchived = useSortedGroupedSessions(workspaceId, archivedSessions);

  const displayGroups = tab === 'active' ? groupedActive : groupedArchived;
  const isGrouped = prefs.group !== 'none';
  const isArchivedView = tab === 'archived';
  const totalVisible = displayGroups.reduce((n, g) => n + g.sessions.length, 0);

  return (
    <div className="flex h-full w-28 shrink-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-1.5 py-1.5">
          <div className="mb-0.5 mt-0.5 flex items-center justify-between gap-1 pl-1 pr-0.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Sessions
            </span>
            <SessionViewMenu workspaceId={workspaceId} />
          </div>

          {!isArchivedView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNewSession}
              aria-label="create new session"
              title="new session"
              className="mb-0.5 w-full justify-center gap-1 px-1 text-[10px]"
            >
              <Plus size={12} aria-hidden />
              New session
            </Button>
          )}

          {displayGroups.map((group) => (
            <Fragment key={group.key}>
              {isGrouped && group.sessions.length > 0 && (
                <div className="mt-2 flex items-center gap-1 px-0.5 first:mt-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    {groupLabel(group.key, prefs.group)}
                  </span>
                  <span aria-hidden className="text-2xs text-muted-foreground/40 tabular-nums">
                    {group.sessions.length}
                  </span>
                  <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
                </div>
              )}
              {group.sessions.map((session) => (
                <SessionActivityItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  dimmed={isArchivedView}
                  onClick={() => onSelectSession(session.id as SessionId)}
                />
              ))}
            </Fragment>
          ))}

          {!isArchivedView && totalVisible === 0 && (
            <p className="px-1 py-3 text-center text-[10px] leading-snug text-muted-foreground/50">
              No sessions yet.
            </p>
          )}
          {isArchivedView && totalVisible === 0 && (
            <p className="px-1 py-3 text-center text-[10px] leading-snug text-muted-foreground/50">
              No archived sessions.
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 p-1.5">
        <button
          type="button"
          onClick={() => {
            const next: ActivityTab = isArchivedView ? 'active' : 'archived';
            if (next === 'archived') {
              onArchivedTabOpen?.();
            }
            setTab(next);
          }}
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
};

type SessionActivityItemProps = {
  session: Session;
  isActive: boolean;
  dimmed?: boolean;
  onClick: () => void;
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
  const isAutoMode = session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);
  const statusEntry = SESSION_STATUS_PALETTE[session.userStatus];
  const StatusIcon = statusEntry.icon;
  const prState = useAppStore((s) => s.sessionGithub[session.id as SessionId]?.pr?.state ?? null);
  const prMeta = prState ? pullRequestMeta(prState) : null;

  const telemetry = useAppStore(
    (s) =>
      s.sessionTelemetry[session.id as SessionId] ??
      (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') {
        continue;
      }
      sum += rec.estimatedCostUsd;
    }
    return sum;
  }, [telemetry]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${session.goal} · ${statusEntry.label}${prMeta ? ` · PR ${prMeta.label}` : ''}`}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded border px-1 py-2 text-center transition-colors',
        isActive
          ? 'bg-elevated text-foreground shadow-sm'
          : 'bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground',
        isActive
          ? 'border-border'
          : isRunning
            ? isAutoMode
              ? 'border-danger/60'
              : 'border-info/60'
            : isPending
              ? 'border-warning/70'
              : isErrored
                ? 'border-danger/40'
                : 'border-transparent',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-1">
        {isRunning ? (
          <Loader2
            size={10}
            aria-hidden
            className={cn('animate-spin shrink-0', isAutoMode ? 'text-danger' : 'text-info')}
          />
        ) : (
          <span className={cn('shrink-0', statusEntry.className)}>
            <StatusIcon size={10} aria-hidden />
          </span>
        )}
        {prState ? (
          <PullRequestChip state={prState} variant="icon" iconSize={10} />
        ) : (
          <span className="inline-flex size-2.5 shrink-0" aria-hidden />
        )}
      </span>
      <span className="line-clamp-2 w-full text-[10px] leading-tight">{session.goal}</span>
      {sessionCost > 0 ? (
        <CostBadge
          value={sessionCost}
          title={`session spend: $${sessionCost.toFixed(2)} (excludes summarizer)`}
          className="text-[9px] font-medium text-muted-foreground/55"
        />
      ) : null}
    </button>
  );
});
