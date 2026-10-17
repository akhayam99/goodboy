import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { commentsWaitingOf } from '../commentsWaitingOf';
import { worktreeRowStateFor } from '../worktreeRowStateFor';
import type { WorktreeRowState } from '../worktreeRowStateOf';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
};

const QUIET: WorktreeRowState = { tone: null, reason: null };

export const useProjectsSignal = ({ sessionId, rows, statuses }: Params): WorktreeRowState => {
  const waiting = useAppStore(
    useShallow((state) => rows.map((row) => commentsWaitingOf({ state, sessionId, row }))),
  );
  return useMemo(() => {
    const states = rows.map((row, index) =>
      worktreeRowStateFor({
        row,
        status: row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null),
        commentsWaiting: waiting[index] ?? 0,
      }),
    );
    return (
      states.find((state) => state.tone === 'danger') ??
      states.find((state) => state.tone === 'warning') ??
      QUIET
    );
  }, [rows, statuses, waiting]);
};
