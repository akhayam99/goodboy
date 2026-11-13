import { attachActionRunSurface } from './attachActionRunSurface';
import { claimActionRun } from './claimActionRun';
import { detachActionRunSurface } from './detachActionRunSurface';
import { dismissActionRun } from './dismissActionRun';
import { dropActionRun } from './dropActionRun';
import { finishActionRun } from './finishActionRun';
import { runAction } from './runAction';
import { actionRunsInitialState } from './state';
import type { SliceDeps } from '../../slice-types';

export const createActionRunsSlice = ({ set, get }: SliceDeps) => ({
  ...actionRunsInitialState,
  claimActionRun: claimActionRun({ set, get }),
  finishActionRun: finishActionRun({ set, get }),
  dismissActionRun: dismissActionRun({ set, get }),
  dropActionRun: dropActionRun({ set }),
  attachActionRunSurface: attachActionRunSurface({ set, get }),
  detachActionRunSurface: detachActionRunSurface({ set, get }),
  runAction: runAction({ get }),
});
