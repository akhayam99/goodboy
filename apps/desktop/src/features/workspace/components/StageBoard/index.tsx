import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, cn, Divider, EmptyState, Eyebrow, Skeleton } from '@goodboy/ui';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useStageGroupedSessions } from '../../../../store';
import { STAGE_ORDER } from '../../../../store/slices/session-view/types';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { PANE_RHYTHM } from '@goodboy/ui';
import { ArchiveSessionConfirm } from '../../../session/components/ArchiveSessionConfirm';
import { DeleteSessionConfirm } from '../../../session/components/DeleteSessionConfirm';
import { WorkspaceGitPanel } from '../WorkspaceGitPanel';
import { BulkActionBar } from '../BulkActionBar';
import { useWorkspaceGitStatus } from '../../hooks/useWorkspaceGitStatus';
import { primaryProjectRoot } from '../../primaryProjectRoot';
import { useDragLasso } from '../../../../shared/hooks/useDragLasso';
import { ProjectsStep } from '../../../onboarding/OnboardingWizard/steps/ProjectsStep';
import { NewSessionProjectPicker } from '../../../session/components/NewSessionProjectPicker';
import { StageColumn } from './StageColumn';
import { useBoardNavigation } from './useBoardNavigation';
import { useBoardSelection } from './useBoardSelection';

type Confirm = { readonly kind: 'archive' | 'delete'; readonly session: Session };

const STAGES: ReadonlyArray<SessionStage> = (
  Object.entries(STAGE_ORDER) as Array<[SessionStage, number]>
)
  .sort((a, b) => a[1] - b[1])
  .map(([stage]) => stage);

const SKELETON_COLUMNS = [3, 2, 2, 1, 2];

const BoardSkeleton = () => (
  <div
    className={cn(
      'mx-auto flex min-h-0 w-fit max-w-full flex-1 overflow-x-hidden',
      PANE_RHYTHM.board.colGap,
    )}
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
            <Skeleton key={i} className="h-[8.25rem] w-full rounded-lg" />
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
  const nav = useBoardNavigation();
  const archived = useAppStore((s) => s.archivedSessions[workspaceId] ?? EMPTY_ARRAY);
  const boardReady = useAppStore((s) => s.boardReady);
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const rootPath = useAppStore((s) => primaryProjectRoot({ projects: s.projects, workspaceId }));
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === workspaceId) ?? null,
  );
  const hasProjects = useAppStore((s) =>
    s.projects.some((project) => project.workspaceId === workspaceId),
  );
  const gitStatus = useWorkspaceGitStatus({ workspaceId });
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const onArchive = useCallback((session: Session) => setConfirm({ kind: 'archive', session }), []);
  const onDelete = useCallback((session: Session) => setConfirm({ kind: 'delete', session }), []);

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
  const selection = useBoardSelection({ activeSessions, archivedSessions: archived });
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const onLassoSelect = useCallback(
    (ids: ReadonlyArray<SessionId>, mode: 'replace' | 'add') => {
      const archivedIds = new Set(archived.map((session) => session.id as SessionId));
      const inArchived = ids.filter((id) => archivedIds.has(id));
      const inActive = ids.filter((id) => !archivedIds.has(id));
      if (inArchived.length > inActive.length) {
        selection.archived.selectIds(inArchived, mode);
        return;
      }
      selection.active.selectIds(inActive, mode);
    },
    [archived, selection],
  );
  const lasso = useDragLasso<SessionId>({ containerRef: columnsRef, onSelect: onLassoSelect });

  const empty = sessions.length === 0;
  const gitReady = gitStatus === null || gitStatus.state === 'ready';
  const showGitPanel = rootPath != null && gitStatus !== null && (!gitReady || !empty);
  const blockedReason = !hasProjects
    ? 'Link a project first'
    : gitStatus?.state === 'missing'
      ? 'The project folder is unreachable'
      : 'This project needs a git repository with one commit first';

  return (
    <div className={cn('flex h-full w-full flex-col gap-4', PANE_RHYTHM.board.pad)}>
      {showGitPanel && rootPath != null && gitStatus !== null && (
        <>
          <div className="shrink-0">
            <WorkspaceGitPanel rootPath={rootPath} status={gitStatus} />
          </div>
          <Divider />
        </>
      )}

      {!boardReady || !empty ? (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4">
            <span className="flex items-baseline gap-2">
              <Eyebrow label="Stage board" />
              <span className="text-2xs tabular-nums text-muted-foreground/60">
                {sessions.length}
              </span>
              {sessions.length > 1 && (
                <span className="hidden text-3xs text-muted-foreground/50 sm:inline">
                  ⌥click to select · drag to lasso
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('goodboy:open-workspace-settings', {
                      detail: { section: 'projects' },
                    }),
                  )
                }
                title="Manage the projects linked to this workspace"
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                + Add project
              </button>
              <Button
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
                disabled={!gitReady || !hasProjects}
                title={gitReady && hasProjects ? undefined : blockedReason}
              >
                <Plus size={14} aria-hidden />
                New session
              </Button>
            </span>
          </div>
          <Divider />
        </>
      ) : null}

      <div className="mx-auto w-full max-w-md shrink-0 empty:hidden">
        <NewSessionProjectPicker workspaceId={workspaceId} />
      </div>

      {!boardReady && <BoardSkeleton />}

      {boardReady && empty && !hasProjects && workspace !== null && (
        <div className="flex flex-1 items-center justify-center overflow-y-auto">
          <div className="w-full max-w-xl py-6">
            <ProjectsStep workspace={workspace} />
          </div>
        </div>
      )}

      {boardReady && hasProjects && empty && gitReady && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            illustration={<DogMascot size={72} className="text-primary" />}
            title="Start your first session"
            description="Describe an outcome; an agent picks it up in its own worktree and branch."
            action={
              <Button
                size="md"
                onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
              >
                <Plus size={16} aria-hidden />
                New session
              </Button>
            }
            size="lg"
            headingLevel={2}
            className="max-w-md"
          />
        </div>
      )}

      {boardReady && !empty && (
        <div className="flex min-h-0 flex-1 overflow-x-auto">
          <div
            ref={columnsRef}
            onPointerDown={lasso.onPointerDown}
            className={cn(
              'relative mx-auto flex min-h-0 w-fit max-w-full',
              PANE_RHYTHM.board.colGap,
            )}
          >
            {STAGES.map((stage) => (
              <StageColumn
                key={stage}
                spec={{ kind: 'stage', stage }}
                sessions={byStage.get(stage) ?? EMPTY_ARRAY}
                nav={nav}
                selection={selection.active}
                onArchive={onArchive}
                onDelete={onDelete}
                onRestore={nav.restore}
              />
            ))}
            <StageColumn
              key="archived"
              spec={{ kind: 'archived' }}
              sessions={archived}
              nav={nav}
              selection={selection.archived}
              onArchive={onArchive}
              onDelete={onDelete}
              onRestore={nav.restore}
            />
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
          </div>
        </div>
      )}

      {selection.selectedSessions.length > 0 && (
        <BulkActionBar
          scope={selection.scope}
          sessions={selection.selectedSessions}
          onSelectAll={
            selection.scope === 'archived'
              ? selection.archived.selectAll
              : selection.active.selectAll
          }
          onClear={selection.clearAll}
          className="shrink-0"
        />
      )}

      {confirm?.kind === 'archive' && (
        <ArchiveSessionConfirm
          session={confirm.session}
          onClose={() => setConfirm(null)}
          className="mx-auto w-full max-w-lg shrink-0"
        />
      )}
      {confirm?.kind === 'delete' && (
        <DeleteSessionConfirm
          session={confirm.session}
          onClose={() => setConfirm(null)}
          className="mx-auto w-full max-w-lg shrink-0"
        />
      )}
    </div>
  );
};
