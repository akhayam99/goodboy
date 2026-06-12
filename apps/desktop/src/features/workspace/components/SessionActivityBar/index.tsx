import { Fragment, memo, useMemo, useState } from 'react';
import { Archive, ChevronRight, Plus } from 'lucide-react';
import { Button, cn, ScrollArea } from '@goodboy/ui';
import type {
  Session,
  SessionGroupKey,
  SessionId,
  SessionStage,
  TelemetryRecord,
  WorkspaceId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionStageInfo,
  useSessionViewPrefs,
  useSortedGroupedSessions,
} from '../../../../store';
import { SESSION_STAGE_META } from '../../../../features/session/session-stage';
import { CostBadge } from '../../../../features/providers/components/CostBadge';
import {
  PullRequestChip,
  pullRequestMeta,
} from '../../../../features/github/components/PullRequestChip';
import { SessionViewMenu } from './SessionViewMenu';

type ActivityTab = 'active' | 'archived';

const PR_GROUP_LABELS: Record<string, string> = {
  'not-open': 'no PR',
  draft: 'draft',
  reviewable: 'in review',
  reviewed: 'approved',
  closed: 'closed',
  merged: 'merged',
};

const COLLAPSED_BY_DEFAULT: ReadonlyArray<string> = ['done', 'merged', 'closed'];

function groupLabel(key: string, groupMode: SessionGroupKey): string {
  if (groupMode === 'stage') {
    return SESSION_STAGE_META[key as SessionStage]?.label ?? key;
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
  const [expandedOverrides, setExpandedOverrides] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );

  const prefs = useSessionViewPrefs(workspaceId);

  const groupedActive = useSortedGroupedSessions(workspaceId, sessions);
  const groupedArchived = useSortedGroupedSessions(workspaceId, archivedSessions);

  const displayGroups = tab === 'active' ? groupedActive : groupedArchived;
  const isGrouped = prefs.group !== 'none';
  const isArchivedView = tab === 'archived';
  const totalVisible = displayGroups.reduce((n, g) => n + g.sessions.length, 0);

  const isCollapsed = (key: string): boolean =>
    expandedOverrides.get(key) ?? COLLAPSED_BY_DEFAULT.includes(key);

  const toggleGroup = (key: string): void => {
    setExpandedOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, !isCollapsed(key));
      return next;
    });
  };

  return (
    <div className="flex h-full w-full shrink-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 px-2 py-2">
          <div className="mb-1 mt-0.5 flex items-center justify-between gap-1 pl-1 pr-0.5">
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
              className="mb-1 w-full justify-center gap-1.5 px-2 text-xs"
            >
              <Plus size={13} aria-hidden />
              New session
            </Button>
          )}

          {displayGroups.map((group) => {
            const collapsed = isGrouped && isCollapsed(group.key);
            const stageMeta =
              prefs.group === 'stage' ? SESSION_STAGE_META[group.key as SessionStage] : undefined;
            return (
              <Fragment key={group.key}>
                {isGrouped && group.sessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!collapsed}
                    title={collapsed ? 'expand group' : 'collapse group'}
                    className="group mt-3 flex w-full items-center gap-1 rounded px-0.5 text-left first:mt-1"
                  >
                    <ChevronRight
                      size={9}
                      aria-hidden
                      className={cn(
                        'shrink-0 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground',
                        !collapsed && 'rotate-90',
                      )}
                    />
                    <span
                      className={cn(
                        'text-2xs font-semibold uppercase tracking-[0.08em]',
                        stageMeta?.textClassName ?? 'text-muted-foreground/60',
                      )}
                    >
                      {groupLabel(group.key, prefs.group)}
                    </span>
                    <span aria-hidden className="text-2xs text-muted-foreground/40 tabular-nums">
                      {group.sessions.length}
                    </span>
                    <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
                  </button>
                )}
                {!collapsed &&
                  group.sessions.map((session) => (
                    <SessionActivityItem
                      key={session.id}
                      session={session}
                      isActive={session.id === currentSessionId}
                      dimmed={isArchivedView}
                      onClick={() => onSelectSession(session.id as SessionId)}
                    />
                  ))}
              </Fragment>
            );
          })}

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

      <div className="shrink-0 p-2">
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
            'flex w-full items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors',
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
  const { stage, reason } = useSessionStageInfo(session);
  const stageMeta = SESSION_STAGE_META[stage];
  const isAutoMode =
    stage === 'running' && session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);
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
      title={`${session.goal} · ${reason}${prMeta ? ` · PR ${prMeta.label}` : ''}`}
      className={cn(
        'flex w-full flex-col items-start gap-1 rounded-md border px-2 py-2 text-left transition-colors',
        isActive
          ? 'bg-elevated text-foreground shadow-sm'
          : 'bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground',
        isActive
          ? 'border-border'
          : stage === 'attention'
            ? 'border-warning/50'
            : stage === 'running'
              ? isAutoMode
                ? 'border-danger/60'
                : 'border-info/60'
              : 'border-transparent',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex w-full items-start gap-1.5">
        <span
          aria-hidden
          className={cn(
            'mt-1 size-1.5 shrink-0 rounded-full',
            isAutoMode ? 'bg-danger' : stageMeta.dotClassName,
            stage === 'running' && 'animate-pulse',
          )}
        />
        <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug">{session.goal}</span>
        {prState && <PullRequestChip state={prState} variant="icon" iconSize={10} />}
      </span>
      <span className="flex w-full items-center gap-1 pl-3">
        <span className="min-w-0 flex-1 truncate text-[10px] leading-tight text-muted-foreground/60">
          {reason}
        </span>
        {sessionCost > 0 && (
          <CostBadge
            value={sessionCost}
            title={`session spend: $${sessionCost.toFixed(2)} (excludes summarizer)`}
            className="shrink-0 text-[10px] font-medium text-muted-foreground/55"
          />
        )}
      </span>
    </button>
  );
});
