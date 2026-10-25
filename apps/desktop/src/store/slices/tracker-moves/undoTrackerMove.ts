import type { SliceDeps } from '../../slice-types';
import { applyTrackerMove } from './applyTrackerMove';
import type { UndoTrackerMoveParams } from './types';

export const undoTrackerMove =
  ({ get }: Pick<SliceDeps, 'get'>) =>
  async ({ move }: UndoTrackerMoveParams): Promise<void> => {
    await applyTrackerMove({ get, move, direction: 'back' });
  };
