import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn, ScrollFade } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useProjectFilteredSessions,
  useStageGroupedSessions,
} from '../../../../store';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useProjectGitStatuses } from '../../hooks/useProjectGitStatuses';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useActionControls } from '../../../actions/useActionControls';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import type { ObjectTarget } from '../../../actions/types';
import { useSessionArchive } from '../../../session/hooks/useSessionArchive';
import { LazyNewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm/LazyNewWorkspaceForm';
import { SetupCard } from '../../../onboarding/SetupCard';
import { useIsMainWindow } from '../../useIsMainWindow';
import { BlockedBoard } from './BlockedBoard';
import { BoardFactsFrame } from './BoardFactsFrame';
import { BoardSkeleton } from './BoardSkeleton';
import { BoardEmpty } from './BoardEmpty';
import { BoardLanes } from './BoardLanes';
import { BOARD_SELECTION_BAR } from './boardSelectionBar';
import { BOARD_STAGES } from './boardStages';
import { useBoardLayout } from './useBoardLayout';
import { useBoardNavigation } from './useBoardNavigation';
import { useArchivedSessionsLoad } from './useArchivedSessionsLoad';
import { useBoardMotionKey } from './useBoardMotionKey';
import { useMarkBoardShown } from './useMarkBoardShown';
import { useBoardSelection } from './useBoardSelection';
import { SessionsHeader } from './SessionsHeader';
import { SessionHoverCard } from '../SessionHoverCard';
import { useHoverCardTarget } from '../SessionHoverCard/useHoverCardTarget';
import { useClearSessionFilters } from './useClearSessionFilters';
import { NeedsYouCards } from './NeedsYouCards';
import { useNeedsYou } from './NeedsYouCards/useNeedsYou';
import { useBoardByStage } from './useBoardByStage';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const StageBoard = ({ workspaceId, sessions }: Props) => {
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const clearFilters = useClearSessionFilters({ workspaceId });
  const nav = useBoardNavigation();
  const hover = useHoverCardTarget();
  const archivedList = useAppStore((s) => s.archivedSessions[workspaceId]);
  const archived = archivedList ?? EMPTY_ARRAY;
  const projectArchived = useProjectFilteredSessions({ workspaceId, sessions: archived });
  const motionResetKey = useBoardMotionKey({ workspaceId });
  const filterSessions = useMemo(() => [...sessions, ...archived], [archived, sessions]);
  const boardReady = useAppStore((s) => s.boardReady && s.switchingToWorkspaceId == null);
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === workspaceId) ?? null,
  );
  const workspaceProjects = useAppStore(
    useShallow((s) => s.projects.filter((project) => project.workspaceId === workspaceId)),
  );
  const hasProjects = workspaceProjects.length > 0;
  const projectGitStatuses = useProjectGitStatuses({ workspaceId });
  const sessionArchive = useSessionArchive();
  const isMainWindow = useIsMainWindow();

  const onRestore = useCallback(
    (session: Session) => sessionArchive.restore({ sessions: [session] }),
    [sessionArchive],
  );
  useArchivedSessionsLoad({ workspaceId, isReady: boardReady });

  const { byStage, infos } = useBoardByStage({ workspaceId, groups, sessions });
  const { cards: needsYouCards } = useNeedsYou({ sessions, infos });
  const stripIds = useMemo(
    () => new Set<string>(needsYouCards.map((card) => card.sessionId)),
    [needsYouCards],
  );

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
  const { ref: frameRef, layout, laneRem } = useBoardLayout();
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
  useMarkBoardShown({ isShown: !pending && sessions.length > 0 });
  const hasUsableProject =
    workspaceProjects.some((project) => project.kind === 'folder') ||
    projectGitStatuses.some(({ status }) => status?.state === 'ready');
  const areAllRepoProjectsMissing =
    projectGitStatuses.length > 0 &&
    projectGitStatuses.every(({ status }) => status?.state === 'missing');
  const statusesPending = projectGitStatuses.some(({ status }) => status === null);
  const blockedReason = !hasProjects
    ? 'Add a folder first'
    : statusesPending
      ? 'Reading git status'
      : areAllRepoProjectsMissing
        ? 'The folder is unreachable'
        : 'This folder needs a git repository with one commit first';
  const unreachableDescription =
    projectGitStatuses.length === 1
      ? "Goodboy can't reach this folder. Relink it in workspace settings."
      : "Goodboy can't reach these folders. Relink them in workspace settings.";
  const hasUnbornRepo = projectGitStatuses.some(({ status }) => status?.state === 'unborn');
  const blockedDescription = areAllRepoProjectsMissing
    ? unreachableDescription
    : hasUnbornRepo
      ? 'Sessions branch from the latest commit, and this repository has none yet.'
      : 'Sessions branch from the latest commit. Add another folder in workspace settings, or track this one with git there.';
  const boardShownIds = new Set<string>(
    groups.flatMap((group) => group.sessions.map((session) => session.id)),
  );
  const hiddenCount = sessions.filter(
    (session) => !boardShownIds.has(session.id) && !stripIds.has(session.id),
  ).length;
  const hoveredId = hover.target?.sessionId ?? null;
  const hoveredSession =
    hoveredId === null ? null : (boardSessions.find((session) => session.id === hoveredId) ?? null);

  return (
    <div ref={boardRef} className={cn('relative flex h-full w-full', PANE_RHYTHM.board.pad)}>
      <div
        ref={frameRef}
        className={cn('mx-auto flex h-full min-h-0 w-full flex-col', PANE_RHYTHM.board.maxWidth)}
      >
        <SessionsHeader
          isShown={pending || !empty || hasProjects}
          workspaceId={workspaceId}
          filterSessions={filterSessions}
          hiddenCount={pending || empty ? 0 : hiddenCount}
          onClearFilters={clearFilters}
        >
          {!pending && hasProjects && empty && <SetupCard isMainWindow={isMainWindow} />}

          {pending && <BoardSkeleton layout={layout} laneRem={laneRem} />}

          {!pending && empty && !hasProjects && workspace !== null && (
            <ScrollFade
              className="min-h-0 flex-1"
              viewportClassName="flex items-center justify-center"
            >
              <div className="w-full max-w-xl py-6">
                <LazyNewWorkspaceForm mode="add" workspaceId={workspace.id} />
              </div>
            </ScrollFade>
          )}

          {!pending && hasProjects && empty && hasUsableProject && <BoardEmpty />}

          {!pending && hasProjects && empty && !hasUsableProject && !statusesPending && (
            <BlockedBoard
              entries={projectGitStatuses}
              title={blockedReason}
              description={blockedDescription}
            />
          )}

          {!pending && !empty && (
            <BoardFactsFrame workspaceId={workspaceId}>
              <BoardLanes
                layout={layout}
                laneRem={laneRem}
                byStage={byStage}
                archived={projectArchived}
                needsYou={
                  <NeedsYouCards
                    workspaceId={workspaceId}
                    sessions={sessions}
                    cards={needsYouCards}
                  />
                }
                needsYouCount={needsYouCards.length}
                isArchivedLoading={archivedList === undefined}
                nav={nav}
                selection={selection}
                onRestore={onRestore}
                motionResetKey={motionResetKey}
                onCardEnter={hover.enter}
                onCardLeave={hover.leave}
              />
            </BoardFactsFrame>
          )}
        </SessionsHeader>
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
      />

      <ObjectSelectionBar
        controls={selectionControls}
        verbIds={BOARD_SELECTION_BAR.verbIds}
        count={selectedIds.length}
        total={selection.total}
        onClear={selection.clearAll}
        onSelectAll={selection.selectAll}
        onDone={selection.clearAll}
        onFocusReturn={focusFirstCard}
        hint={BOARD_SELECTION_BAR.hint}
      />
    </div>
  );
};
