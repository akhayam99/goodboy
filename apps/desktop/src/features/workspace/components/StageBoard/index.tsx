import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import { Button, cn, EmptyState, ScrollFade, Skeleton } from '@goodboy/ui';
import type {
  Session,
  SessionAttentionReason,
  SessionId,
  SessionPageView,
  WorkspaceId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useProjectFilteredSessions,
  useSessionListModel,
  useSessionViewPrefs,
  useStageGroupedSessions,
} from '../../../../store';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useProjectGitStatuses } from '../../hooks/useProjectGitStatuses';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useActionControls } from '../../../actions/useActionControls';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import type { ObjectTarget } from '../../../actions/types';
import { useSessionArchive } from '../../../session/hooks/useSessionArchive';
import { attentionPlace } from '../../../session/attentionPlace';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { BoardLanes } from './BoardLanes';
import { boardLanesOf, rootRemPx } from './boardLanesOf';
import { BOARD_STAGES } from './boardStages';
import { useBoardNavigation } from './useBoardNavigation';
import { useBoardSelection } from './useBoardSelection';
import { SessionsHeader } from './SessionsHeader';
import { SessionsList } from './SessionsList';
import { SessionsListSkeleton } from './SessionsListSkeleton';
import { listStageGroupsOf } from './SessionsList/listStageGroupsOf';
import { SessionHoverCard } from '../SessionHoverCard';
import { useHoverCardTarget } from '../SessionHoverCard/useHoverCardTarget';
import { useClearSessionFilters } from '../SessionActivityBar/useClearSessionFilters';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const SKELETON_CARDS = [3, 2, 2, 1, 2, 1];

const SELECTION_VERB_IDS = ['sessions.archive', 'sessions.restore', 'sessions.delete'];

const WIDTH_BEFORE_MEASURE = Number.POSITIVE_INFINITY;

type SkeletonProps = {
  readonly lanes: 5 | 6;
};

type OpenAttention = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

const BoardSkeleton = ({ lanes }: SkeletonProps) => (
  <div
    className={cn(
      'grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden',
      PANE_RHYTHM.board.laneGap,
      lanes === 6 ? PANE_RHYTHM.board.lanesSix : PANE_RHYTHM.board.lanesFive,
    )}
    role="status"
    aria-label="Loading board"
  >
    {SKELETON_CARDS.slice(0, lanes).map((cards, lane) => (
      <div key={lane} className={cn('flex min-h-0 flex-col', PANE_RHYTHM.board.laneStack)}>
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className={cn('flex flex-col', PANE_RHYTHM.board.cardGap)}>
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const StageBoard = ({ workspaceId, sessions }: Props) => {
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const listModel = useSessionListModel(workspaceId, sessions);
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((s) => s.setSessionViewPrefs);
  const navigate = useAppStore((s) => s.navigate);
  const clearFilters = useClearSessionFilters({ workspaceId });
  const view = prefs.pageView;
  const nav = useBoardNavigation();
  const hover = useHoverCardTarget();
  const { close: closeHover } = hover;
  const archivedList = useAppStore((s) => s.archivedSessions[workspaceId]);
  const archived = archivedList ?? EMPTY_ARRAY;
  const projectArchived = useProjectFilteredSessions({ workspaceId, sessions: archived });
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
  const onViewChange = useCallback(
    (next: SessionPageView) => {
      closeHover();
      setSessionViewPrefs({ workspaceId, patch: { pageView: next } });
    },
    [closeHover, setSessionViewPrefs, workspaceId],
  );
  const onArchivedShownChange = useCallback(
    (isShown: boolean) => setSessionViewPrefs({ workspaceId, patch: { isArchivedShown: isShown } }),
    [setSessionViewPrefs, workspaceId],
  );
  const openAttention = useCallback(
    ({ sessionId, reason }: OpenAttention) => {
      closeHover();
      navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) });
    },
    [closeHover, navigate],
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

  const boardSessions = useMemo(
    () => [
      ...BOARD_STAGES.flatMap((stage) => [...(byStage.get(stage) ?? EMPTY_ARRAY)]),
      ...projectArchived,
    ],
    [byStage, projectArchived],
  );
  const selection = useBoardSelection({ sessions: boardSessions });
  const { selectedIds } = selection;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const frame = useElementWidth();
  const remPx = useMemo(() => rootRemPx(), []);
  const layout = boardLanesOf({ width: frame.width ?? WIDTH_BEFORE_MEASURE, remPx });
  const selectionTarget = useMemo<ObjectTarget | null>(
    () => (selectedIds.length === 0 ? null : { kind: 'sessions', sessionIds: selectedIds }),
    [selectedIds],
  );
  const selectionControls = useActionControls({ target: selectionTarget });
  const triggerSelectionAction = selectionControls.trigger;
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
    boardRef.current?.querySelector<HTMLElement>('[data-select-id] button')?.focus();
  }, []);

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
  const boardShown = groups.reduce((count, group) => count + group.sessions.length, 0);
  const shownArchived = prefs.isArchivedShown ? projectArchived : EMPTY_ARRAY;
  const listGroups = listStageGroupsOf({
    byStage,
    statusFilter: prefs.statusFilter,
    archived: shownArchived,
  });
  const listShown = listGroups.reduce((count, group) => count + group.sessions.length, 0);
  const listLiveShown = listShown - shownArchived.length;
  const hiddenCount = sessions.length - (view === 'board' ? boardShown : listLiveShown);
  const hoveredId = hover.target?.sessionId ?? null;
  const hoveredSession =
    hoveredId === null ? null : (boardSessions.find((session) => session.id === hoveredId) ?? null);

  return (
    <div ref={boardRef} className={cn('relative flex h-full w-full', PANE_RHYTHM.board.pad)}>
      <div
        ref={frame.ref}
        className={cn(
          'mx-auto flex h-full min-h-0 w-full flex-col',
          view === 'list' ? PANE_RHYTHM.board.listMaxWidth : PANE_RHYTHM.board.maxWidth,
        )}
      >
        {pending || !empty || hasProjects ? (
          <SessionsHeader
            workspaceId={workspaceId}
            view={view}
            onViewChange={onViewChange}
            filterSessions={filterSessions}
            archivedCount={archived.length}
            onArchivedShownChange={onArchivedShownChange}
            hiddenCount={pending || empty ? 0 : hiddenCount}
            onClearFilters={clearFilters}
          />
        ) : null}

        {pending && view === 'board' && <BoardSkeleton lanes={layout.lanes} />}

        {pending && view === 'list' && <SessionsListSkeleton />}

        {!pending && empty && !hasProjects && workspace !== null && (
          <ScrollFade
            className="min-h-0 flex-1"
            viewportClassName="flex items-center justify-center"
          >
            <div className="w-full max-w-xl py-6">
              <NewWorkspaceForm mode="add" workspaceId={workspace.id} />
            </div>
          </ScrollFade>
        )}

        {!pending && hasProjects && empty && hasUsableProject && (
          <div data-slot="board-empty" className="flex min-w-0 flex-col">
            <EmptyState
              icon={CONCEPT_ICONS.sessions}
              title="No sessions yet"
              description="A session holds one goal, its worktrees and its agents."
              action={
                <Button
                  size="md"
                  onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
                >
                  <Plus size={ICON_SIZE.control} aria-hidden />
                  New session
                </Button>
              }
              size="page"
              headingLevel={2}
            />
          </div>
        )}

        {!pending && hasProjects && empty && !hasUsableProject && !statusesPending && (
          <div data-slot="board-empty" className="flex min-w-0 flex-col">
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
              size="page"
              headingLevel={2}
            />
          </div>
        )}

        {!pending && !empty && view === 'board' && (
          <BoardLanes
            layout={layout}
            byStage={byStage}
            archived={projectArchived}
            isArchivedLoading={archivedList === undefined}
            nav={nav}
            selection={selection}
            onRestore={onRestore}
            onCardEnter={hover.enter}
            onCardLeave={hover.leave}
          />
        )}

        {!pending && !empty && view === 'list' && (
          <ScrollFade className="min-h-0 flex-1">
            <div className="flex w-full flex-col gap-4">
              {listShown === 0 ? (
                <EmptyState
                  size="section"
                  icon={CONCEPT_ICONS.sessions}
                  title="No sessions match"
                />
              ) : (
                <SessionsList
                  groups={listGroups}
                  inactiveLabels={listModel.inactiveLabels}
                  onOpen={nav.selectCard}
                />
              )}
            </div>
          </ScrollFade>
        )}
      </div>

      <SessionHoverCard
        session={hoveredSession}
        isArchived={
          hoveredId !== null && projectArchived.some((session) => session.id === hoveredId)
        }
        anchor={hover.target?.anchor ?? null}
        boundary={null}
        onKeep={hover.keep}
        onLeave={hover.leave}
        onClose={hover.close}
        onOpenAttention={openAttention}
        isFactsOnly
      />

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
