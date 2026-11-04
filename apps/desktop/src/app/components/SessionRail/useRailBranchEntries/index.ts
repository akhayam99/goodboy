import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { commentsWaitingOf } from '../SessionLevel/commentsWaitingOf';
import { worktreeRowStateFor } from '../SessionLevel/worktreeRowStateFor';
import type { RailBranchEntry } from '../railBranchesSplitOf';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
  readonly shownPath: string | null;
};

export const useRailBranchEntries = ({
  sessionId,
  rows,
  statuses,
  shownPath,
}: Params): ReadonlyArray<RailBranchEntry> => {
  const commentsWaiting = useAppStore(
    useShallow((state) => rows.map((row) => commentsWaitingOf({ state, sessionId, row }))),
  );
  return useMemo(
    () =>
      rows.map((row, index) => ({
        row,
        state: worktreeRowStateFor({
          row,
          status: row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null),
          commentsWaiting: commentsWaiting[index] ?? 0,
        }),
        isShown: row.worktreePath !== null && row.worktreePath === shownPath,
      })),
    [rows, statuses, commentsWaiting, shownPath],
  );
};
