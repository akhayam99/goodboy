import type { SessionId } from '@goodboy/types';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

export const DOCK_GRID_RECALL_KEY = 'recall';

export const dockGridWrites = createSerialQueue();

export const dockGridRecalls = createLatestOnly();

export const DOCK_GRID_MOVE_KEY = 'move';

export const dockGridMoves = createLatestOnly();

type OwnerParams = {
  readonly sessionId: SessionId | null;
};

let owner: SessionId | null = null;

export const dockGridOwner = {
  read: (): SessionId | null => owner,
  take: ({ sessionId }: OwnerParams): void => {
    owner = sessionId;
  },
};
