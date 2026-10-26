import type { SessionId } from '@goodboy/types';
import type { TrackerMove } from './types';

export type TrackerMovesState = {
  readonly trackerMoves: Readonly<Record<SessionId, ReadonlyArray<TrackerMove>>>;
  readonly trackerMoveSettled: Readonly<Record<SessionId, ReadonlyArray<string>>>;
  readonly trackerMoveChecks: Readonly<Record<SessionId, string>>;
};

export const trackerMovesInitialState: TrackerMovesState = {
  trackerMoves: {},
  trackerMoveSettled: {},
  trackerMoveChecks: {},
};
