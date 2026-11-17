import type { HistoryRun } from '../../store/slices/history/types';
import type { WorktreeStatusRead } from '../../store/runtime/worktreeStatuses/cache';
import { isRebaseStopRelevant } from './isRebaseStopRelevant';

type Params = {
  readonly run: HistoryRun;
  readonly read: WorktreeStatusRead | null | undefined;
};

export const isRebaseRunStale = ({ run, read }: Params): boolean =>
  read !== null &&
  read !== undefined &&
  run.origin === 'rebase' &&
  run.phase === 'stopped' &&
  run.stop !== null &&
  run.pushFix === undefined &&
  (run.rebaseConflict?.autoAgentId ?? null) === null &&
  run.rebaseConflict?.isHere !== true &&
  read.readAt > run.updatedAt &&
  !isRebaseStopRelevant({
    reason: run.stop.reason,
    head: run.stop.head ?? run.rebaseConflict?.head ?? null,
    status: read.status,
  });
