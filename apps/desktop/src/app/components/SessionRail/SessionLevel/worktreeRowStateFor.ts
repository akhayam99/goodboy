import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { mainBehindOf, unmergedCount } from '../../../../shared/lib/gitStatus';
import {
  worktreeRowStateOf,
  type EntryShownFact,
  type WorktreeRowState,
} from './worktreeRowStateOf';

type Params = {
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly commentsWaiting: number;
  readonly shownByEntries?: ReadonlySet<EntryShownFact>;
};

export const worktreeRowStateFor = ({
  row,
  status,
  commentsWaiting,
  shownByEntries,
}: Params): WorktreeRowState =>
  worktreeRowStateOf({
    checks: row.request?.checks ?? null,
    behind: mainBehindOf({ status, isDone: row.isFinished }),
    conflicts:
      status === null || row.isFinished ? null : unmergedCount({ workingTree: status.workingTree }),
    isRebasing: !row.isFinished && status?.inProgress === 'rebase',
    isDecisionWaiting: row.observation !== null,
    commentsWaiting,
    baseBranch: row.baseBranch,
    ...(shownByEntries !== undefined && { shownByEntries }),
  });
