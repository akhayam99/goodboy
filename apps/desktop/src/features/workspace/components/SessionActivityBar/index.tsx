import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronRight, Plus } from 'lucide-react';
import {
  Button,
  EmptyState,
  Eyebrow,
  formatUsd,
  KbdPill,
  cn,
  ScrollArea,
  StatusDot,
} from '@goodboy/ui';
import type {
  Session,
  SessionGroupKey,
  SessionId,
  SessionStage,
  WorkspaceId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionCost,
  useSessionStageInfo,
  useSessionViewPrefs,
  useSortedGroupedSessions,
} from '../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../features/session/session-stage';
import { CostBadge } from '../../../../features/providers/components/CostBadge';
import {
  PullRequestChip,
  pullRequestMeta,
} from '../../../../features/github/components/PullRequestChip';
import { ExternalTaskChip } from '../../../../features/integrations/components/ExternalTaskChip';
import { useMultiSelect } from '../../../../shared/hooks/useMultiSelect';
import { useDragLasso } from '../../../../shared/hooks/useDragLasso';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';
import { sessionCardShell } from '../../../session/components/sessionCardShell';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { BulkActionBar } from '../BulkActionBar';
import { useSidebarPeekHold } from '../SidebarPeekOverlay/hold';
import { SessionViewMenu } from './SessionViewMenu';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

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

type Props = {
  workspaceId: WorkspaceId;
  sessions: ReadonlyArray<Session>;
  archivedSessions: ReadonlyArray<Session>;
  currentSessionId: SessionId | null;
  onSelectSession: (id: SessionId) => void;
  onArchivedTabOpen?: () => void;
};

export const SessionActivityBar = ({
  workspaceId,
  sessions,
  archivedSessions,
  currentSessionId,
  onSelectSession,
  onArchivedTabOpen,
}: Props) => {
  const [tab, setTab] = useState<ActivityTab>('active');

  useEffect(() => {
    const onNewSessionRequest = () => {
      setTab('active');
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, []);
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

  const visibleOrder = useMemo(
    () => displayGroups.flatMap((group) => group.sessions.map((s) => s.id as SessionId)),
    [displayGroups],
  );
  const selection = useMultiSelect(visibleOrder);
  const { clear: clearSelection, isSelected } = selection;

  const visibleSessions = isArchivedView ? archivedSessions : sessions;
  const selectedSessions = useMemo(
    () => visibleSessions.filter((s) => isSelected(s.id as SessionId)),
    [visibleSessions, isSelected],
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const { selectIds } = selection;
  const onLassoSelect = useCallback(
    (ids: ReadonlyArray<SessionId>, mode: 'replace' | 'add') => selectIds(ids, mode),
    [selectIds],
  );
  const lasso = useDragLasso<SessionId>({
    containerRef: listRef,
    onSelect: onLassoSelect,
    requireAlt: true,
  });

  useEffect(() => {
    clearSelection();
  }, [tab, clearSelection]);

  const { hold, release } = useSidebarPeekHold();
  const hasSelection = selectedSessions.length > 0;
  useEffect(() => {
    if (!hasSelection) {
      return;
    }
    hold();
    return () => release();
  }, [hasSelection, hold, release]);

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
        <div
          ref={listRef}
          onPointerDown={lasso.onPointerDown}
          className={cn(
            'relative flex flex-col',
            PANE_RHYTHM.sessionList.cardGap,
            PANE_RHYTHM.sessionList.pad,
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
            <Eyebrow label="Sessions" />
            <div className="flex items-center gap-0.5">
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
                title={isArchivedView ? 'Hide archived sessions' : 'Show archived sessions'}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium transition-colors',
                  isArchivedView
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                )}
              >
                <Archive size={10} aria-hidden />
                Archived
              </button>
              <SessionViewMenu workspaceId={workspaceId} />
            </div>
          </div>

          {!isArchivedView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
              aria-label="Create new session"
              title={`Create new session (${shortcutGlyphs('session.new')})`}
              className="group relative mb-1 w-full justify-center gap-1.5 px-2 text-xs"
            >
              <Plus size={13} aria-hidden />
              New
              <KbdPill
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-3xs opacity-0 transition-opacity group-hover:opacity-100"
              >
                {shortcutGlyphs('session.new')}
              </KbdPill>
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
                    title={collapsed ? 'Expand group' : 'Collapse group'}
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
                    <span aria-hidden className="text-2xs text-muted-foreground tabular-nums">
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
                      selected={isSelected(session.id as SessionId)}
                      onModifierClick={selection.handleItemClick}
                      onClick={() => onSelectSession(session.id as SessionId)}
                    />
                  ))}
              </Fragment>
            );
          })}

          {lasso.rect && (
            <div
              aria-hidden
              style={{
                left: lasso.rect.left,
                top: lasso.rect.top,
                width: lasso.rect.width,
                height: lasso.rect.height,
              }}
              className="pointer-events-none absolute z-10 rounded-sm border border-primary/60 bg-primary/10"
            />
          )}

          {totalVisible === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.sessions}
              tone={CONCEPT_TONE.sessions}
              title={isArchivedView ? 'No archived sessions' : 'No sessions yet'}
              size="inline"
              className="px-1 py-3"
            />
          ) : null}
        </div>
      </ScrollArea>

      {selectedSessions.length > 0 && (
        <div className="shrink-0 p-2">
          <BulkActionBar
            scope={isArchivedView ? 'archived' : 'active'}
            sessions={selectedSessions}
            onSelectAll={selection.selectAll}
            onClear={clearSelection}
          />
        </div>
      )}
    </div>
  );
};

type SelectionClickEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type SessionActivityItemProps = {
  session: Session;
  isActive: boolean;
  dimmed?: boolean;
  selected?: boolean;
  onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  onClick: () => void;
};

const SessionActivityItem = memo(function SessionActivityItem({
  session,
  isActive,
  dimmed,
  selected,
  onModifierClick,
  onClick,
}: SessionActivityItemProps) {
  const { stage, reason } = useSessionStageInfo(session);
  const isAutoMode =
    stage === 'running' && session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);
  const prState = useAppStore((s) => s.sessionGithub[session.id as SessionId]?.pr?.state ?? null);
  const prMeta = prState ? pullRequestMeta(prState) : null;
  const externalTasks = useAppStore(
    (s) => s.sessionExternalTasks[session.id as SessionId] ?? EMPTY_ARRAY,
  );

  const sessionCost = useSessionCost(session.id as SessionId);
  const age = formatRelativeAge({ fromIso: session.updatedAt });

  return (
    <button
      type="button"
      data-select-id={session.id}
      aria-pressed={selected === true}
      aria-keyshortcuts="Alt+Enter"
      onClick={(event) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
          onModifierClick(session.id as SessionId, event);
          return;
        }
        onClick();
      }}
      onKeyDown={(event) => {
        if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }
        event.preventDefault();
        onModifierClick(session.id as SessionId, event);
      }}
      title={`${session.goal} · ${reason}${prMeta ? ` · PR ${prMeta.label}` : ''}${externalTasks.length > 0 ? ` · ${externalTasks.map((task) => task.identifier).join(', ')}` : ''}`}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-2.5 py-2.5 text-left',
        sessionCardShell({ stage, selected, active: isActive, dimmed }),
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex w-full items-start gap-2">
          <span className="inline-flex h-5 shrink-0 items-center">
            <StatusDot
              tone={isAutoMode ? 'primary' : STAGE_TONE[stage]}
              size="sm"
              pulsing={stage === 'running'}
            />
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
            {session.goal}
          </span>
          {externalTasks.map((task) => (
            <ExternalTaskChip
              key={`${task.provider}:${task.externalId}`}
              task={task}
              variant="icon"
            />
          ))}
          {prState && <PullRequestChip state={prState} variant="icon" iconSize={11} />}
        </span>
        <span className="flex w-full items-center gap-1.5 pl-[14px]">
          <span className="min-w-0 flex-1 truncate text-2xs leading-tight text-muted-foreground/60">
            {reason}
          </span>
          {age && (
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">{age}</span>
          )}
          {sessionCost > 0 && (
            <CostBadge
              value={sessionCost}
              title={`Session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
              className="shrink-0 text-2xs font-medium text-muted-foreground/55"
            />
          )}
        </span>
      </span>
      <ChevronRight size={14} aria-hidden className="shrink-0 text-muted-foreground/50" />
    </button>
  );
});
