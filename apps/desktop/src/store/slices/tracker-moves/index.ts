import type { SliceDeps } from '../../slice-types';
import { checkTrackerMoves } from './checkTrackerMoves';
import { moveTrackerItem } from './moveTrackerItem';
import { undoTrackerMove } from './undoTrackerMove';

export const createTrackerMovesSlice = ({ set, get }: SliceDeps) => ({
  checkTrackerMoves: checkTrackerMoves({ set, get }),
  moveTrackerItem: moveTrackerItem({ set, get }),
  undoTrackerMove: undoTrackerMove({ get }),
});
