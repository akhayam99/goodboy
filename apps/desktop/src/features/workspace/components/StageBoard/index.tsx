import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import { Button, cn, EmptyState, ScrollFade, Skeleton, Tooltip, tintClasses } from '@goodboy/ui';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useProjectFilteredSessions,
  useStageGroupedSessions,
} from '../../../../store';
import { STAGE_ORDER } from '../../../../store/slices/session-view/types';
import { PANE_RHYTHM } from '@goodboy/ui';
import { EmptyBoardStages } from './EmptyBoardStages';
import { useProjectGitStatuses } from '../../hooks/useProjectGitStatuses';
import { useDragLasso } from '../../../../shared/hooks/useDragLasso';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useActionControls } from '../../../actions/useActionControls';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import type { ObjectTarget } from '../../../actions/types';
import { useSessionArchive } from '../../../session/hooks/useSessionArchive';
import { ProjectsStep } from '../../../onboarding/OnboardingWizard/steps/ProjectsStep';
import { StageColumn, type ColumnCollapse } from './StageColumn';
import { BoardDock } from './BoardDock';
import { describeDockColumn } from './BoardDock/describeDockColumn';
import { boardColumnIds } from './boardColumnIds';
import { useBoardCollapse, type BoardCollapsibleColumn } from '../../hooks/useBoardCollapse';
import { useBoardNavigation } from './useBoardNavigation';
import { useBoardSelection } from './useBoardSelection';
import { ProjectFilter } from '../ProjectFilter';
import { OngoingTasksRow } from './OngoingTasksRow';
import { sessionsOnOngoingTask } from './sessionsOnOngoingTask';
import { ProjectGitPills } from '../ProjectGitPill';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const STAGES: ReadonlyArray<SessionStage> = (
  Object.entries(STAGE_ORDER) as Array<[SessionStage, number]>
)
  .sort((a, b) => a[1] - b[1])
  .map(([stage]) => stage);

const BOARD_COLLAPSIBLE_COLUMNS: ReadonlyArray<BoardCollapsibleColumn> = ['done', 'archived'];

const SKELETON_COLUMNS = [3, 2, 2, 1];

const SELECTION_VERB_IDS = ['sessions.archive', 'sessions.restore', 'sessions.delete'];

const BoardSkeleton = () => (
  <div
    className={cn('flex min-h-0 w-full flex-1 overflow-x-hidden', PANE_RHYTHM.board.colGap)}
    role="status"
    aria-label="Loading board"
  >
    {SKELETON_COLUMNS.map((cards, col) => (
      <div
        key={col}
        className={cn(
          'flex min-h-0 flex-col',
          PANE_RHYTHM.board.colWidth,
          PANE_RHYTHM.board.colStack,
        )}
      >
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className={cn('flex flex-col', PANE_RHYTHM.board.cardGap)}>
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
    <div className={cn('flex shrink-0 flex-col items-center gap-2', PANE_RHYTHM.board.dock)}>
      <Skeleton className="size-8 rounded-md" />
      <Skeleton className="size-8 rounded-md" />
    </div>
  </div>
);

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

type FocusRequest = {
  readonly id: string;
  readonly revealId: string | null;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly hasNewSession?: boolean;
};

export const StageBoard = ({ workspaceId, sessions, hasNewSession = true }: Props) => {
  const [ongoingFilter, setOngoingFilter] = useState<string | null>(null);
  const ongoingSessionIds = useAppStore(
    useShallow((s) =>
      sessionsOnOngoingTask({
        sessionExternalTasks: s.sessionExternalTasks,
        filter: ongoingFilter,
      }),
    ),
  );
  const shownSessions = useMemo(
    () =>
      ongoingFilter === null
        ? sessions
        : sessions.filter((session) => ongoingSessionIds.includes(session.id)),
    [ongoingFilter, ongoingSessionIds, sessions],
  );
  const groups = useStageGroupedSessions(workspaceId, shownSessions);
  const nav = useBoardNavigation();
  const archivedList = useAppStore((s) => s.archivedSessions[workspaceId]);
  const archived = archivedList ?? EMPTY_ARRAY;
  const projectArchived = useProjectFilteredSessions({ workspaceId, sessions: archived });
  const filteredArchived = useMemo(
    () =>
      ongoingFilter === null
        ? projectArchived
        : projectArchived.filter((session) => ongoingSessionIds.includes(session.id)),
    [ongoingFilter, ongoingSessionIds, projectArchived],
  );
  const filterSessions = useMemo(() => [...sessions, ...archived], [archived, sessions]);
  const boardReady = useAppStore((s) => s.boardReady);
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === workspaceId) ?? null,
  );
  const workspaceProjects = useAppStore(
    useShallow((s) => s.projects.filter((project) => project.workspaceId === workspaceId)),
  );
  const hasProjects = workspaceProjects.length > 0;
  const projectGitStatuses = useProjectGitStatuses({ workspaceId });
  const sessionArchive = useSessionArchive();

  const onRestore = useCallback(
    (session: Session) => void sessionArchive.restore({ sessions: [session] }),
    [sessionArchive],
  );

  useEffect(() => {
    void loadArchivedSessions(workspaceId);
  }, [loadArchivedSessions, workspaceId]);

  const byStage = useMemo(() => {
    const map = new Map<string, ReadonlyArray<Session>>();
    for (const group of groups) {
      map.set(group.key, group.sessions);
    }
    return map;
  }, [groups]);

  const activeSessions = useMemo(
    () => STAGES.flatMap((stage) => [...(byStage.get(stage) ?? EMPTY_ARRAY)]),
    [byStage],
  );
  const selection = useBoardSelection({ activeSessions, archivedSessions: filteredArchived });
  const { selectedIds } = selection;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectionTarget = useMemo<ObjectTarget | null>(
    () => (selectedIds.length === 0 ? null : { kind: 'sessions', sessionIds: selectedIds }),
    [selectedIds],
  );
  const selectionControls = useActionControls({ target: selectionTarget });
  const triggerSelectionAction = selectionControls.trigger;
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const onLassoSelect = useCallback(
    (ids: ReadonlyArray<SessionId>, mode: 'replace' | 'add') => {
      const archivedIds = new Set(filteredArchived.map((session) => session.id as SessionId));
      const inArchived = ids.filter((id) => archivedIds.has(id));
      const inActive = ids.filter((id) => !archivedIds.has(id));
      if (inArchived.length > inActive.length) {
        selection.archived.selectIds(inArchived, mode);
        return;
      }
      selection.active.selectIds(inActive, mode);
    },
    [filteredArchived, selection],
  );
  const lasso = useDragLasso<SessionId>({
    containerRef: columnsRef,
    onSelect: onLassoSelect,
    ignoreSelector: '[data-board-dock]',
  });
  const onSelectionKeyToggle = useCallback(
    (id: string) => selection.onToggle(id as SessionId),
    [selection],
  );
  const onSelectionKeyDelete = useCallback(
    () => triggerSelectionAction({ actionId: 'sessions.delete' }),
    [triggerSelectionAction],
  );
  useSelectionKeys({
    containerRef: boardRef,
    hasSelection: selectedIds.length > 0,
    onToggle: onSelectionKeyToggle,
    onSelectAll: selection.selectAll,
    onDelete: onSelectionKeyDelete,
  });
  const focusFirstCard = useCallback(() => {
    columnsRef.current?.querySelector<HTMLElement>('[data-select-id] button')?.focus();
  }, []);

  const { collapsed, setCollapsed } = useBoardCollapse({ workspaceId });
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const clearArchivedSelection = selection.archived.clear;

  useEffect(() => {
    if (!collapsed.archived) {
      return;
    }
    clearArchivedSelection();
  }, [clearArchivedSelection, collapsed.archived]);

  useEffect(() => {
    if (focusRequest === null) {
      return;
    }
    setFocusRequest(null);
    document.getElementById(focusRequest.id)?.focus({ preventScroll: true });
    if (focusRequest.revealId === null) {
      return;
    }
    document.getElementById(focusRequest.revealId)?.scrollIntoView?.({
      inline: 'nearest',
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [focusRequest]);

  const openColumn = useCallback(
    (column: BoardCollapsibleColumn) => {
      const ids = boardColumnIds({ key: column });
      setCollapsed({ column, isCollapsed: false });
      setFocusRequest({ id: ids.collapse, revealId: ids.column });
    },
    [setCollapsed],
  );

  const collapseColumn = useCallback(
    (column: BoardCollapsibleColumn) => {
      setCollapsed({ column, isCollapsed: true });
      setFocusRequest({ id: boardColumnIds({ key: column }).dock, revealId: null });
    },
    [setCollapsed],
  );

  const doneSessions = byStage.get('done') ?? EMPTY_ARRAY;
  const columnCounts: Record<BoardCollapsibleColumn, number> = {
    done: doneSessions.length,
    archived: filteredArchived.length,
  };
  const collapseFor = (column: BoardCollapsibleColumn): ColumnCollapse => ({
    label: describeDockColumn({ column, count: columnCounts[column] }).ariaLabel,
    onCollapse: () => collapseColumn(column),
  });
  const dockEntries = BOARD_COLLAPSIBLE_COLUMNS.filter((column) => collapsed[column]).map(
    (column) => ({ column, count: columnCounts[column] }),
  );
  const openStages = STAGES.filter((stage) => stage !== 'done' || !collapsed.done);

  const empty = sessions.length === 0 && archived.length === 0;
  const pending = !boardReady || (sessions.length === 0 && archivedList === undefined);
  const hasUsableProject =
    workspaceProjects.some((project) => project.kind === 'folder') ||
    projectGitStatuses.some(({ status }) => status?.state === 'ready');
  const areAllRepoProjectsMissing =
    projectGitStatuses.length > 0 &&
    projectGitStatuses.every(({ status }) => status?.state === 'missing');
  const statusesPending = projectGitStatuses.some(({ status }) => status === null);
  const blockedReason = !hasProjects
    ? 'Link a project first'
    : statusesPending
      ? 'Reading git status'
      : areAllRepoProjectsMissing
        ? 'The project folder is unreachable'
        : 'This project needs a git repository with one commit first';
  const unreachableDescription =
    projectGitStatuses.length === 1
      ? 'Goodboy cannot reach the folder this project points to. Relink it in workspace settings.'
      : 'Goodboy cannot reach the folders these projects point to. Relink them in workspace settings.';
  const blockedDescription = areAllRepoProjectsMissing
    ? unreachableDescription
    : 'Sessions branch from the latest commit. Open the git pill on the project and make the first commit, or link another project in workspace settings.';

  const newSessionButton = (
    <Button
      size="sm"
      onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
      disabled={!hasUsableProject}
    >
      <Plus size={ICON_SIZE.control} aria-hidden />
      New session
    </Button>
  );

  return (
    <div
      ref={boardRef}
      className={cn(
        'relative mx-auto flex h-full w-full',
        PANE_RHYTHM.board.maxWidth,
        PANE_RHYTHM.stack,
        'gap-6',
        PANE_RHYTHM.board.pad,
      )}
    >
      {pending || !empty || hasProjects ? (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4">
            <span className="flex min-w-0 items-baseline gap-2">
              <h1 className="text-title text-foreground">Board</h1>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <ProjectGitPills entries={projectGitStatuses} />
              <ProjectFilter workspaceId={workspaceId} sessions={filterSessions} />
              {!hasNewSession ? null : hasUsableProject ? (
                newSessionButton
              ) : (
                <Tooltip content={blockedReason} side="bottom">
                  {newSessionButton}
                </Tooltip>
              )}
            </span>
          </div>
          {pending ? null : (
            <OngoingTasksRow
              workspaceId={workspaceId}
              filter={ongoingFilter}
              onFilter={setOngoingFilter}
            />
          )}
        </>
      ) : null}

      {pending && <BoardSkeleton />}

      {!pending && empty && !hasProjects && workspace !== null && (
        <ScrollFade className="min-h-0 flex-1" viewportClassName="flex items-center justify-center">
          <div className="w-full max-w-xl py-6">
            <ProjectsStep workspace={workspace} />
          </div>
        </ScrollFade>
      )}

      {!pending && hasProjects && empty && hasUsableProject && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            illustration={<EmptyBoardStages />}
            title="Start your first session"
            action={
              <Button
                size="md"
                onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
              >
                <Plus size={ICON_SIZE.control} aria-hidden />
                New session
              </Button>
            }
            size="lg"
            headingLevel={2}
            className="max-w-md"
          />
        </div>
      )}

      {!pending && hasProjects && empty && !hasUsableProject && !statusesPending && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={CONCEPT_ICONS.projectRepo}
            title={blockedReason}
            description={blockedDescription}
            action={
              <Button
                size="md"
                variant="secondary"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('goodboy:open-settings', { detail: { scope: 'workspace' } }),
                  )
                }
              >
                Open workspace settings
              </Button>
            }
            size="lg"
            headingLevel={2}
            className="max-w-md"
          />
        </div>
      )}

      {!pending && !empty && (
        <ScrollFade orientation="horizontal" fadeSize="w-8" className="min-h-0 flex-1">
          <div
            ref={columnsRef}
            onPointerDown={lasso.onPointerDown}
            data-selecting={selectedIds.length > 0}
            className={cn(
              'group/select-list relative flex h-full min-h-0 w-max min-w-full',
              PANE_RHYTHM.board.colGap,
            )}
          >
            {openStages.map((stage) => (
              <StageColumn
                key={stage}
                spec={{ kind: 'stage', stage }}
                sessions={byStage.get(stage) ?? EMPTY_ARRAY}
                nav={nav}
                selection={selection}
                onClearSelection={selection.clearAll}
                onRestore={onRestore}
                collapse={stage === 'done' ? collapseFor('done') : undefined}
              />
            ))}
            {!collapsed.archived && (
              <StageColumn
                key="archived"
                spec={{ kind: 'archived' }}
                sessions={filteredArchived}
                nav={nav}
                selection={selection}
                onClearSelection={selection.clearAll}
                onRestore={onRestore}
                collapse={collapseFor('archived')}
              />
            )}
            {dockEntries.length > 0 && (
              <BoardDock
                entries={dockEntries}
                isLassoActive={lasso.isDragging}
                onOpen={openColumn}
              />
            )}
            {lasso.rect && (
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
            )}
          </div>
        </ScrollFade>
      )}

      <ObjectSelectionBar
        controls={selectionControls}
        verbIds={SELECTION_VERB_IDS}
        count={selectedIds.length}
        total={selection.total}
        onClear={selection.clearAll}
        onSelectAll={selection.selectAll}
        onDone={selection.clearAll}
        onFocusReturn={focusFirstCard}
      />
    </div>
  );
};
