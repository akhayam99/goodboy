import { acceptSessionNudgeHandoff } from './acceptSessionNudgeHandoff';
import { dismissSessionNudge } from './dismissSessionNudge';
import { recordNudgeShown } from './recordNudgeShown';
import { recordNudgeOutcome } from './recordNudgeOutcome';
import type { SliceDeps } from '../../slice-types';

export const createNudgesSlice = ({ set, get }: SliceDeps) => {
  return {
    dismissSessionNudge: dismissSessionNudge(set, get),
    acceptSessionNudgeHandoff: acceptSessionNudgeHandoff(set, get),
    recordNudgeShown,
    recordNudgeOutcome,
  };
};
