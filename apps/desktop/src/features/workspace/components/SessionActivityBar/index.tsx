import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import { Archive, Check, ChevronRight, Plus } from 'lucide-react';
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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
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
}: Props) => {
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

  const onToggleSelect = (id: SessionId, event: SelectionClickEvent) => {
    if (event.shiftKey) {
      selection.selectRange(id);
      return;
    }
    selection.toggle(id);
  };

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
        <div className="flex flex-col gap-1.5 px-2.5 py-2.5">
          <div className="mb-1.5 mt-0.5 flex items-center justify-between gap-1 pl-1 pr-0.5">
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
                title={isArchivedView ? 'hide archived sessions' : 'show archived sessions'}
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
              onClick={onNewSession}
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
                      onToggleSelect={onToggleSelect}
                      onModifierClick={selection.handleItemClick}
                      onClick={() => onSelectSession(session.id as SessionId)}
                    />
                  ))}
              </Fragment>
            );
          })}

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
  onToggleSelect: (id: SessionId, event: SelectionClickEvent) => void;
  onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  onClick: () => void;
};

const SessionActivityItem = memo(function SessionActivityItem({
  session,
  isActive,
  dimmed,
  selected,
  onToggleSelect,
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

  const body = (
    <button
      type="button"
      onClick={(event) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          onModifierClick(session.id as SessionId, event);
          return;
        }
        onClick();
      }}
      title={`${session.goal} · ${reason}${prMeta ? ` · PR ${prMeta.label}` : ''}${externalTasks.length > 0 ? ` · ${externalTasks.map((task) => task.identifier).join(', ')}` : ''}`}
      className={cn(
        'flex w-full flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors',
        isActive
          ? 'bg-elevated text-foreground shadow-sm'
          : 'bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground',
        isActive
          ? 'border-border'
          : stage === 'attention'
            ? 'border-warning/50'
            : stage === 'running'
              ? 'border-info/60'
              : 'border-transparent',
        dimmed && 'opacity-50',
      )}
    >
      <span className="flex w-full items-start gap-2">
        <span className="inline-flex h-5 shrink-0 items-center">
          <StatusDot
            tone={isAutoMode ? 'danger' : STAGE_TONE[stage]}
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
        {sessionCost > 0 && (
          <CostBadge
            value={sessionCost}
            title={`session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
            className="shrink-0 text-2xs font-medium text-muted-foreground/55"
          />
        )}
      </span>
    </button>
  );

  return (
    <div className="group/select flex w-full items-center gap-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={selected === true}
        aria-label={`select ${session.goal}`}
        onClick={(event) => onToggleSelect(session.id as SessionId, event)}
        title={selected ? 'deselect session' : 'select session · shift-click to extend'}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border motion-safe:transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border-soft opacity-0 hover:border-primary/50 focus-visible:opacity-100 group-hover/select:opacity-100',
        )}
      >
        {selected === true && <Check size={11} aria-hidden />}
      </button>
      <span className="min-w-0 flex-1">{body}</span>
    </div>
  );
});
