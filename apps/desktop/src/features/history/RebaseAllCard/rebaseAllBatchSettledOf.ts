import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import type { RebaseAllRun } from '../../../store/slices/rebaseAll/types';
import { isRebaseStopSettled } from '../isRebaseStopSettled';

type Params = {
  readonly run: RebaseAllRun | null;
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
};

type SettledParams = {
  readonly status: WorktreeStatus | undefined;
};

export const isRebasedBranchSettled = ({ status }: SettledParams): boolean =>
  isRebaseStopSettled({ status, head: null });

export const rebaseAllBatchSettledOf = ({ run, rows, statuses }: Params): boolean => {
  if (run === null) {
    return true;
  }
  return run.branches
    .filter((branch) => branch.state === 'auto')
    .every((branch) => {
      const row = rows.find((candidate) => candidate.mountId === branch.mountId);
      const path = row?.worktreePath ?? null;
      return isRebasedBranchSettled({ status: path === null ? undefined : statuses.get(path) });
    });
};
