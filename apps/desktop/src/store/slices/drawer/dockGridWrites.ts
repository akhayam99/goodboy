import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

export const DOCK_GRID_RECALL_KEY = 'recall';

export const dockGridWrites = createSerialQueue();

export const dockGridRecalls = createLatestOnly();

export const DOCK_GRID_MOVE_KEY = 'move';

export const dockGridMoves = createLatestOnly();
