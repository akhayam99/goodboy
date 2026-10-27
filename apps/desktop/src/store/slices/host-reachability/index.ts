import { clearHostOutage } from './clearHostOutage';
import { dismissRecoveredHost } from './dismissRecoveredHost';
import { noteHostAnswer } from './noteHostAnswer';
import { retryHost } from './retryHost';
import type { SliceDeps } from '../../slice-types';

export const createHostReachabilitySlice = ({ set, get }: SliceDeps) => {
  return {
    noteHostAnswer: noteHostAnswer({ set, get }),
    clearHostOutage: clearHostOutage({ set, get }),
    retryHost: retryHost({ set, get }),
    dismissRecoveredHost: dismissRecoveredHost({ set, get }),
  };
};
