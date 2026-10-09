import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eyebrow,
  FilledEmptyState,
  PANE_RHYTHM,
  ROW_INTERACTIVE,
  cn,
  ScrollFade,
  tintClasses,
} from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import {
  useAppStore,
  useProjectFilteredSessions,
  useSessionColumn,
  useSessionViewPrefs,
} from '../../../../store';
import { sortAndGroupSessions } from '../../../../store/slices/session-view/sortAndGroupSessions';
import { FOLD_LIMIT, PINNED_GROUP_KEY } from '../../../../store/slices/session-view/types';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { useMultiSelect } from '../../../../shared/hooks/useMultiSelect';
import { useDragLasso } from '../../../../shared/hooks/useDragLasso';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useActionControls } from '../../../actions/useActionControls';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import type { ObjectTarget } from '../../../actions/types';
import { attentionPlace } from '../../../session/attentionPlace';
import { useSidebarPeekHold } from '../SidebarPeekOverlay/hold';
import { SessionHoverCard } from '../SessionHoverCard';
import { useHoverCardTarget } from '../SessionHoverCard/useHoverCardTarget';
import { sessionGroupPresentation } from './groupPresentation';
import { SessionViewMenu } from './SessionViewMenu';
import { SessionActivityItem } from './SessionActivityItem';
import { SessionGroupHeader } from './SessionGroupHeader';
import { SessionPages } from './SessionPages';
import { SESSION_CARD_CLASS } from './sessionCard';

const SELECTION_VERB_IDS = ['sessions.archive', 'sessions.restore', 'sessions.delete'];

const EMPTY_SESSIONS: ReadonlyArray<Session> = [];

type Props = {
  workspaceId: WorkspaceId;
  sessions: ReadonlyArray<Session>;
  archivedSessions: ReadonlyArray<Session>;
  currentSessionId: SessionId | null;
  onSelectSession: (id: SessionId) => void;
  onArchivedTabOpen?: () => void;
};

type OpenAttention = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

export const SessionActivityBar = ({
  workspaceId,
  sessions,
  archivedSessions,
  currentSessionId,
  onSelectSession,
  onArchivedTabOpen,
}: Props) => {
  const toggleSessionGroup = useAppStore((s) => s.toggleSessionGroup);
  const setSessionViewPrefs = useAppStore((s) => s.setSessionViewPrefs);
  const navigate = useAppStore((s) => s.navigate);
  const prefs = useSessionViewPrefs(workspaceId);
  const column = useSessionColumn(workspaceId, sessions);
  const [foldedPagesFor, setFoldedPagesFor] = useState<SessionId | null>(null);
  const hover = useHoverCardTarget();
  const { close: closeHover } = hover;

  const filterSessions = useMemo(
    () => (prefs.isArchivedShown ? [...sessions, ...archivedSessions] : sessions),
    [archivedSessions, prefs.isArchivedShown, sessions],
  );
  const filteredArchived = useProjectFilteredSessions({
    workspaceId,
    sessions: archivedSessions,
  });
  const shownArchived = useMemo(
    () =>
      prefs.isArchivedShown
        ? (sortAndGroupSessions({
            sessions: filteredArchived,
            prefs: { ...prefs, group: 'none' },
            githubState: {},
          })[0]?.sessions ?? EMPTY_SESSIONS)
        : EMPTY_SESSIONS,
    [filteredArchived, prefs],
  );
  const archivedIds = useMemo(
    () => new Set(shownArchived.map((session) => session.id)),
    [shownArchived],
  );

  useEffect(() => {
    onArchivedTabOpen?.();
  }, [onArchivedTabOpen]);

  useEffect(() => {
    setFoldedPagesFor(null);
  }, [currentSessionId]);

  const visibleOrder = useMemo(
    () => [...column.order, ...shownArchived.map((session) => session.id as SessionId)],
    [column.order, shownArchived],
  );
  const selection = useMultiSelect(visibleOrder);
  const { clear: clearSelection, isSelected } = selection;
  const selectedRef = useRef(selection.selected);
  selectedRef.current = selection.selected;
  const getSelectedIds = useCallback(() => selectedRef.current, []);

  const everySession = useMemo(() => [...sessions, ...shownArchived], [sessions, shownArchived]);
  const selectedSessions = useMemo(
    () => everySession.filter((s) => isSelected(s.id as SessionId)),
    [everySession, isSelected],
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const { selectIds, toggle, selectRange, selectAll } = selection;
  const onToggleSelect = useCallback(
    (id: SessionId, event: { readonly shiftKey: boolean }) => {
      if (event.shiftKey) {
        selectRange(id);
        return;
      }
      toggle(id);
    },
    [selectRange, toggle],
  );
  const selectedIds = useMemo(
    () => selectedSessions.map((session) => session.id as SessionId),
    [selectedSessions],
  );
  const selectionTarget = useMemo<ObjectTarget | null>(
    () => (selectedIds.length === 0 ? null : { kind: 'sessions', sessionIds: selectedIds }),
    [selectedIds],
  );
  const selectionControls = useActionControls({ target: selectionTarget });
  const triggerSelectionAction = selectionControls.trigger;
  useSelectionKeys({
    containerRef: barRef,
    hasSelection: selectedIds.length > 0,
    onToggle: (id) => toggle(id as SessionId),
    onSelectAll: selectAll,
    onDelete: () => triggerSelectionAction({ actionId: 'sessions.delete' }),
  });
  const focusFirstRow = useCallback(() => {
    listRef.current?.querySelector<HTMLElement>('[data-select-id]')?.focus();
  }, []);
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
  }, [prefs.isArchivedShown, clearSelection]);

  const { hold, release } = useSidebarPeekHold();
  const hasSelection = selectedSessions.length > 0;
  useEffect(() => {
    if (!hasSelection) {
      return;
    }
    hold();
    return () => release();
  }, [hasSelection, hold, release]);

  const selectSession = useCallback(
    (id: SessionId) => {
      closeHover();
      onSelectSession(id);
    },
    [closeHover, onSelectSession],
  );

  const toggleFold = useCallback(() => {
    closeHover();
    setSessionViewPrefs({ workspaceId, patch: { isFoldOpen: !prefs.isFoldOpen } });
  }, [closeHover, prefs.isFoldOpen, setSessionViewPrefs, workspaceId]);

  const setArchivedShown = useCallback(
    (isShown: boolean) => setSessionViewPrefs({ workspaceId, patch: { isArchivedShown: isShown } }),
    [setSessionViewPrefs, workspaceId],
  );

  const setPagesShown = useCallback(
    ({ sessionId, isShown }: { readonly sessionId: SessionId; readonly isShown: boolean }) =>
      setFoldedPagesFor(isShown ? null : sessionId),
    [],
  );

  const openAttention = useCallback(
    ({ sessionId, reason }: OpenAttention) => {
      closeHover();
      navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) });
    },
    [closeHover, navigate],
  );

  const moveFocus = (delta: number) => {
    const rows = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(
        '[data-select-id], [data-selected], [data-fold]',
      ) ?? []),
    ];
    const index = rows.findIndex((row) => row === document.activeElement);
    if (index === -1) {
      return;
    }
    rows[Math.max(0, Math.min(rows.length - 1, index + delta))]?.focus();
  };

  const hoveredId = hover.target?.sessionId ?? null;
  const hoveredSession =
    hoveredId === null ? null : (everySession.find((session) => session.id === hoveredId) ?? null);

  const total = column.groups.reduce((count, group) => count + group.total, 0);
  const foldableTotal = column.groups
    .filter((group) => group.key !== PINNED_GROUP_KEY)
    .reduce((count, group) => count + group.total, 0);
  const isFoldShown =
    !column.isGrouped &&
    (column.hiddenCount > 0 || (prefs.isFoldOpen && foldableTotal > FOLD_LIMIT));

  const renderRow = (session: Session, isArchived: boolean) => {
    const id = session.id as SessionId;
    const isActive = id === currentSessionId;
    const isPagesShown = isActive && foldedPagesFor !== id && !isArchived;
    const row = (
      <SessionActivityItem
        session={session}
        isActive={isActive}
        isPagesShown={isPagesShown}
        isArchived={isArchived}
        isSelected={isSelected(id)}
        getSelectedIds={getSelectedIds}
        onClearSelection={clearSelection}
        onModifierClick={selection.handleItemClick}
        onToggleSelect={onToggleSelect}
        onSelect={selectSession}
        onRowEnter={hover.enter}
        onRowLeave={hover.leave}
        onPagesToggle={setPagesShown}
      />
    );
    const isCard = isActive && !isArchived;
    return (
      <li key={session.id} className="flex flex-col">
        {isCard ? (
          <div data-session-card className={SESSION_CARD_CLASS}>
            {row}
            {isPagesShown ? <SessionPages session={session} /> : null}
          </div>
        ) : (
          row
        )}
      </li>
    );
  };

  return (
    <div ref={barRef} className="relative flex h-full min-h-0 w-full shrink-0 flex-col gap-1">
      <div
        className={cn(
          'flex h-7 shrink-0 items-center justify-between',
          PANE_RHYTHM.sessionList.headerInset,
        )}
      >
        <Eyebrow label="Sessions" muted />
        <SessionViewMenu
          workspaceId={workspaceId}
          sessions={filterSessions}
          archivedCount={archivedSessions.length}
          onArchivedShownChange={setArchivedShown}
        />
      </div>

      <ScrollFade className="min-h-0 flex-1">
        <div
          ref={listRef}
          onPointerDown={lasso.onPointerDown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              moveFocus(event.key === 'ArrowDown' ? 1 : -1);
            }
          }}
          data-selecting={selectedIds.length > 0}
          className={cn(
            'group/select-list relative flex flex-col gap-1 data-[selecting=true]:pb-24',
            PANE_RHYTHM.sessionList.pad,
          )}
        >
          {column.groups.map((group) => {
            const presentation = sessionGroupPresentation({
              key: group.key,
              groupMode: prefs.group,
            });
            const isHeadered = column.isGrouped || group.label !== null;
            return (
              <div key={group.key} className="flex flex-col gap-0.5">
                {isHeadered ? (
                  <SessionGroupHeader
                    label={presentation?.label ?? group.label ?? group.key}
                    tone={presentation?.tone ?? 'neutral'}
                    total={group.total}
                    title={presentation === null ? undefined : stateDescription({ presentation })}
                    isCollapsed={group.isCollapsed}
                    onToggle={
                      column.isGrouped ? () => toggleSessionGroup({ key: group.key }) : undefined
                    }
                  />
                ) : null}
                {group.isCollapsed ? null : (
                  <ul role="list" className={cn('flex flex-col', PANE_RHYTHM.sessionList.rowGap)}>
                    {group.sessions.map((session) => renderRow(session, false))}
                  </ul>
                )}
              </div>
            );
          })}

          {isFoldShown ? (
            <button
              type="button"
              data-fold
              aria-expanded={prefs.isFoldOpen}
              onClick={toggleFold}
              className={cn(
                'flex h-7 w-full items-center gap-2 rounded-md pl-7 pr-2 text-left text-meta text-faint-foreground hover:text-foreground',
                ROW_INTERACTIVE,
              )}
            >
              <span>{prefs.isFoldOpen ? 'Show fewer' : `Show ${column.hiddenCount} more`}</span>
            </button>
          ) : null}

          {shownArchived.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {column.isGrouped ? (
                <span className="mt-2 flex h-6 items-center px-2">
                  <Eyebrow label="Archived" muted />
                </span>
              ) : null}
              <ul role="list" className={cn('flex flex-col', PANE_RHYTHM.sessionList.rowGap)}>
                {shownArchived.map((session) => renderRow(session, true))}
              </ul>
            </div>
          ) : null}

          {lasso.rect != null ? (
            <div
              aria-hidden
              style={{
                left: lasso.rect.left,
                top: lasso.rect.top,
                width: lasso.rect.width,
                height: lasso.rect.height,
              }}
              className={cn(
                'pointer-events-none absolute z-10 rounded-sm border',
                tintClasses('primary').border,
                tintClasses('primary').bg,
              )}
            />
          ) : null}

          {total === 0 && shownArchived.length === 0 ? (
            <FilledEmptyState
              icon={CONCEPT_ICONS.sessions}
              tone={CONCEPT_TONE.sessions}
              title="No sessions yet"
            />
          ) : null}
        </div>
      </ScrollFade>

      <SessionHoverCard
        session={hoveredSession}
        isArchived={hoveredId !== null && archivedIds.has(hoveredId)}
        anchor={hover.target?.anchor ?? null}
        boundary={barRef.current}
        onKeep={hover.keep}
        onLeave={hover.leave}
        onClose={hover.close}
        onOpenAttention={openAttention}
      />

      <ObjectSelectionBar
        controls={selectionControls}
        verbIds={SELECTION_VERB_IDS}
        count={selectedIds.length}
        total={visibleOrder.length}
        onClear={clearSelection}
        onSelectAll={selectAll}
        onDone={clearSelection}
        onFocusReturn={focusFirstRow}
      />
    </div>
  );
};
