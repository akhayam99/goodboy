import type { BranchTab } from '../../store/slices/navigation/types';
import { commentTabLiveOf } from '../resolve/commentTabLiveOf';
import type { FixRun } from '../resolve/fixRun';
import type { LaneStatus } from '../resolve/laneStatus';
import { checkTabLiveOf } from './checks/checkTabLiveOf';
import type { BranchCheckWork } from './hooks/useBranchCheckStep';

type Params = {
  readonly checkWork: BranchCheckWork;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
};

export const branchTabLiveOf = ({
  checkWork,
  run,
  lane,
}: Params): Readonly<Partial<Record<BranchTab, string>>> => {
  const checks = checkTabLiveOf({ work: checkWork });
  const comments = commentTabLiveOf({ run, lane });
  return {
    ...(checks === null ? {} : { checks }),
    ...(comments === null ? {} : { comments }),
  };
};
