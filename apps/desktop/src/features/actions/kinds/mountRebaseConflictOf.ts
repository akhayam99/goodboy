import type { HistoryRun } from '../../../store/slices/history/types';
import { rebaseConflictOf } from '../../history/rebaseConflictOf';
import type { MountRebaseConflict } from './mountFacts';

type Params = {
  readonly run: HistoryRun | undefined;
};

export const mountRebaseConflictOf = ({ run }: Params): MountRebaseConflict | null => {
  const conflict = rebaseConflictOf({ run });
  if (conflict === null) {
    return null;
  }
  return { isWithAuto: conflict.autoAgentId !== null, count: conflict.count };
};
