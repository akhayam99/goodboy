import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import { Button, cn, EmptyState, ScrollFade, Skeleton, Tooltip } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useProjectFilteredSessions,
  useStageGroupedSessions,
} from '../../../../store';
import { PANE_RHYTHM } from '@goodboy/ui';
import { EmptyBoardStages } from './EmptyBoardStages';
import { useProjectGitStatuses } from '../../hooks/useProjectGitStatuses';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useActionControls } from '../../../actions/useActionControls';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import type { ObjectTarget } from '../../../actions/types';
import { useSessionArchive } from '../../../session/hooks/useSessionArchive';
import { ProjectsStep } from '../../../onboarding/OnboardingWizard/steps/ProjectsStep';
import { BoardLanes } from './BoardLanes';
import { boardLanesOf } from './boardLanesOf';
import { BOARD_STAGES } from './boardStages';
import { useBoardNavigation } from './useBoardNavigation';
import { useBoardSelection } from './useBoardSelection';
import { ProjectFilter } from '../ProjectFilter';
import { OngoingTasksRow } from './OngoingTasksRow';
import { sessionsOnOngoingTask } from './sessionsOnOngoingTask';
import { ProjectGitPills } from '../ProjectGitPill';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const SKELETON_CARDS = [3, 2, 2, 1, 2, 1];

const SELECTION_VERB_IDS = ['sessions.archive', 'sessions.restore', 'sessions.delete'];

const WIDTH_BEFORE_MEASURE = Number.POSITIVE_INFINITY;

type SkeletonProps = {
  readonly lanes: 5 | 6;
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
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

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

  const boardSessions = useMemo(
    () => [
      ...BOARD_STAGES.flatMap((stage) => [...(byStage.get(stage) ?? EMPTY_ARRAY)]),
      ...filteredArchived,
    ],
    [byStage, filteredArchived],
  );
  const selection = useBoardSelection({ sessions: boardSessions });
  const { selectedIds } = selection;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const frame = useElementWidth();
  const layout = boardLanesOf({ width: frame.width ?? WIDTH_BEFORE_MEASURE });
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
    <div ref={boardRef} className={cn('relative flex h-full w-full', PANE_RHYTHM.board.pad)}>
      <div
        ref={frame.ref}
        className={cn(
          'mx-auto flex h-full min-h-0 w-full flex-col gap-6',
          PANE_RHYTHM.board.maxWidth,
        )}
      >
        {pending || !empty || hasProjects ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-2">
                <h1 className="text-title text-foreground">Board</h1>
                <ProjectGitPills entries={projectGitStatuses} isQuiet />
              </span>
              <span className="flex shrink-0 items-center gap-2">
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

        {pending && <BoardSkeleton lanes={layout.lanes} />}

        {!pending && empty && !hasProjects && workspace !== null && (
          <ScrollFade
            className="min-h-0 flex-1"
            viewportClassName="flex items-center justify-center"
          >
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
          <BoardLanes
            layout={layout}
            byStage={byStage}
            archived={filteredArchived}
            isArchivedLoading={archivedList === undefined}
            nav={nav}
            selection={selection}
            onRestore={onRestore}
          />
        )}
      </div>

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
