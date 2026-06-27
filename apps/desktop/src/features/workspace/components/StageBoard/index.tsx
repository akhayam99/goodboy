import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Divider, Eyebrow, Skeleton } from '@goodboy/ui';
import type { Session, SessionStage, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useStageGroupedSessions } from '../../../../store';
import { STAGE_ORDER } from '../../../../store/slices/session-view/types';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { ArchiveSessionDialog } from '../../../session/components/ArchiveSessionDialog';
import { DeleteSessionDialog } from '../../../session/components/DeleteSessionDialog';
import { StageColumn } from './StageColumn';
import { useBoardNavigation } from './useBoardNavigation';

type Confirm = { readonly kind: 'archive' | 'delete'; readonly session: Session };

const STAGES: ReadonlyArray<SessionStage> = (
  Object.entries(STAGE_ORDER) as Array<[SessionStage, number]>
)
  .sort((a, b) => a[1] - b[1])
  .map(([stage]) => stage);

const SKELETON_COLUMNS = [3, 2, 2, 1, 2];

const BoardSkeleton = () => (
  <div
    className="flex min-h-0 flex-1 gap-4 overflow-x-hidden"
    role="status"
    aria-label="Loading board"
  >
    {SKELETON_COLUMNS.map((cards, col) => (
      <div key={col} className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

type StageBoardProps = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly onCreateSession: () => void;
};

export const StageBoard = ({ workspaceId, sessions, onCreateSession }: StageBoardProps) => {
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const nav = useBoardNavigation();
  const archived = useAppStore((s) => s.archivedSessions[workspaceId] ?? EMPTY_ARRAY);
  const boardReady = useAppStore((s) => s.boardReady);
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
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

  const empty = sessions.length === 0;

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <span className="flex items-baseline gap-2">
          <Eyebrow label="Stage board" />
          <span className="text-2xs tabular-nums text-muted-foreground/60">{sessions.length}</span>
        </span>
        <Button size="sm" onClick={onCreateSession}>
          <Plus size={14} aria-hidden />
          New session
        </Button>
      </div>

      <Divider />

      {!boardReady ? (
        <BoardSkeleton />
      ) : empty ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40">
              <DogMascot size={48} className="text-foreground" />
            </div>
            <div className="flex flex-col gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Start your first session
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Describe an outcome. An agent picks it up in its own worktree and branch; your main
                checkout stays untouched.
              </p>
            </div>
            <Button size="md" onClick={onCreateSession}>
              <Plus size={16} aria-hidden />
              New session
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage}
              spec={{ kind: 'stage', stage }}
              sessions={byStage.get(stage) ?? EMPTY_ARRAY}
              nav={nav}
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
            onArchive={onArchive}
            onDelete={onDelete}
            onRestore={nav.restore}
          />
        </div>
      )}

      {confirm?.kind === 'archive' && (
        <ArchiveSessionDialog session={confirm.session} open onClose={() => setConfirm(null)} />
      )}
      {confirm?.kind === 'delete' && (
        <DeleteSessionDialog session={confirm.session} open onClose={() => setConfirm(null)} />
      )}
    </div>
  );
};
