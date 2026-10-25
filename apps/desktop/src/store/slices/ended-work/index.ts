import { dismissEndedScripts } from './dismissEndedScripts';
import { dismissEndedTerminal } from './dismissEndedTerminal';
import { loadEndedWork } from './loadEndedWork';
import type { SliceDeps } from '../../slice-types';

export const createEndedWorkSlice = ({ set, get }: SliceDeps) => {
  return {
    loadEndedWork: loadEndedWork({ set, get }),
    dismissEndedTerminal: dismissEndedTerminal({ set }),
    dismissEndedScripts: dismissEndedScripts({ set }),
  };
};
