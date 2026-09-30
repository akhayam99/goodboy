import { acceptSessionNudgeHandoff } from './acceptSessionNudgeHandoff';
import { dismissSessionNudge } from './dismissSessionNudge';
import type { SliceDeps } from '../../slice-types';

export const createNudgesSlice = ({ set, get }: SliceDeps) => {
  return {
    dismissSessionNudge: dismissSessionNudge(set, get),
    acceptSessionNudgeHandoff: acceptSessionNudgeHandoff(set, get),
  };
};
