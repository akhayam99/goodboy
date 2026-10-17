import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { commentsWaitingOf } from '../commentsWaitingOf';
import { worktreeRowStateFor } from '../worktreeRowStateFor';
import type { EntryShownFact, WorktreeRowState } from '../worktreeRowStateOf';

type Params = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly shownByEntries?: ReadonlySet<EntryShownFact>;
};

export const useWorktreeRowState = ({
  sessionId,
  row,
  status,
  shownByEntries,
}: Params): WorktreeRowState => {
  const commentsWaiting = useAppStore((state) => commentsWaitingOf({ state, sessionId, row }));
  return worktreeRowStateFor({
    row,
    status,
    commentsWaiting,
    ...(shownByEntries !== undefined && { shownByEntries }),
  });
};
