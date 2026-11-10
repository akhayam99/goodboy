import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn, ScrollFade } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useProjectFilteredSessions,
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
import { SetupCard } from '../../../onboarding/SetupCard';
import { useIsMainWindow } from '../../useIsMainWindow';
import { BlockedBoard } from './BlockedBoard';
import { BoardFactsFrame } from './BoardFactsFrame';
import { BoardSkeleton } from './BoardSkeleton';
import { BoardEmpty } from './BoardEmpty';
import { BoardLanes } from './BoardLanes';
import { boardLanesOf, rootRemPx } from './boardLanesOf';
import { scrollLaneRemOf } from './scrollLaneRemOf';
import { BOARD_STAGES } from './boardStages';
import { useBoardNavigation } from './useBoardNavigation';
import { useArchivedSessionsLoad } from './useArchivedSessionsLoad';
import { useBoardMotionKey } from './useBoardMotionKey';
import { useBoardSelection } from './useBoardSelection';
import { useNeedsYouElsewhere } from './useNeedsYouElsewhere';
import { SessionsHeader } from './SessionsHeader';
import { SessionHoverCard } from '../SessionHoverCard';
import { useHoverCardTarget } from '../SessionHoverCard/useHoverCardTarget';
import { useClearSessionFilters } from '../SessionActivityBar/useClearSessionFilters';

const SELECTION_VERB_IDS = [
  'sessions.markRead',
  'sessions.archive',
  'sessions.restore',
  'sessions.delete',
];

const WIDTH_BEFORE_MEASURE = Number.POSITIVE_INFINITY;

type OpenAttention = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const StageBoard = ({ workspaceId, sessions }: Props) => {
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const needsYouElsewhere = useNeedsYouElsewhere({ workspaceId, sessions });
  const setSessionViewPrefs = useAppStore((s) => s.setSessionViewPrefs);
  const navigate = useAppStore((s) => s.navigate);
  const clearFilters = useClearSessionFilters({ workspaceId });
  const nav = useBoardNavigation();
  const hover = useHoverCardTarget();
  const { close: closeHover } = hover;
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
    (session: Session) => void sessionArchive.restore({ sessions: [session] }),
    [sessionArchive],
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

  useArchivedSessionsLoad({ workspaceId });

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
  const scrollLaneRem = scrollLaneRemOf({ width: frame.width ?? WIDTH_BEFORE_MEASURE, remPx });
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
    ? 'Add a folder first'
    : statusesPending
      ? 'Reading git status'
      : areAllRepoProjectsMissing
        ? 'The folder is unreachable'
        : 'This folder needs a git repository with one commit first';
  const unreachableDescription =
    projectGitStatuses.length === 1
      ? 'Goodboy cannot reach this folder. Relink it in workspace settings.'
      : 'Goodboy cannot reach these folders. Relink them in workspace settings.';
  const hasUnbornRepo = projectGitStatuses.some(({ status }) => status?.state === 'unborn');
  const blockedDescription = areAllRepoProjectsMissing
    ? unreachableDescription
    : hasUnbornRepo
      ? 'Sessions branch from the latest commit, and this repository has none yet.'
      : 'Sessions branch from the latest commit. Add another folder in workspace settings, or track this one with git there.';
  const boardShown = groups.reduce((count, group) => count + group.sessions.length, 0);
  const hiddenCount = sessions.length - boardShown;
  const hoveredId = hover.target?.sessionId ?? null;
  const hoveredSession =
    hoveredId === null ? null : (boardSessions.find((session) => session.id === hoveredId) ?? null);

  return (
    <div ref={boardRef} className={cn('relative flex h-full w-full', PANE_RHYTHM.board.pad)}>
      <div
        ref={frame.ref}
        className={cn('mx-auto flex h-full min-h-0 w-full flex-col', PANE_RHYTHM.board.maxWidth)}
      >
        <SessionsHeader
          isShown={pending || !empty || hasProjects}
          workspaceId={workspaceId}
          filterSessions={filterSessions}
          archivedCount={archived.length}
          onArchivedShownChange={onArchivedShownChange}
          hiddenCount={pending || empty ? 0 : hiddenCount}
          needsYouElsewhere={pending || empty ? 0 : needsYouElsewhere}
          onClearFilters={clearFilters}
        >
          {!pending && hasProjects && empty && <SetupCard isMainWindow={isMainWindow} />}

          {pending && <BoardSkeleton lanes={layout.lanes} />}

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
                scrollLaneRem={scrollLaneRem}
                byStage={byStage}
                archived={projectArchived}
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
