import type { SliceDeps } from '../../slice-types';
import { applyTrackerMove } from './applyTrackerMove';
import { readTrackerMove } from './readTrackerMove';
import { trackerTasksOf } from './trackerTasksOf';
import type { MoveTrackerItemParams, MoveTrackerItemResult } from './types';
import { sessionById } from '../sessions/sessionIndex';

const movesInFlight = new Map<string, Promise<MoveTrackerItemResult>>();

const runMove = async ({
  set,
  get,
  sessionId,
  key,
}: SliceDeps & MoveTrackerItemParams): Promise<MoveTrackerItemResult> => {
  const offered = (get().trackerMoves[sessionId] ?? []).find((move) => move.key === key);
  const session = sessionById(get().sessions, sessionId);
  if (offered === undefined || session === undefined) {
    return { kind: 'gone' };
  }
  const task = trackerTasksOf({ state: get(), sessionId }).find(
    (candidate) => `${candidate.provider}:${candidate.externalId}` === key,
  );
  if (task === undefined) {
    return { kind: 'gone' };
  }
  const fresh = await readTrackerMove({ get, task, workspaceId: offered.workspaceId });
  if (fresh.kind === 'unknown') {
    throw new Error(`${offered.identifier} no longer has a ${offered.toName} to move to.`);
  }
  if (fresh.kind === 'open') {
    await applyTrackerMove({ get, move: fresh.move, direction: 'forward' });
  }
  const settledMove = fresh.kind === 'open' ? fresh.move : offered;
  set((state) => ({
    trackerMoves: {
      ...state.trackerMoves,
      [sessionId]: (state.trackerMoves[sessionId] ?? []).filter((move) => move.key !== key),
    },
    trackerMoveSettled: {
      ...state.trackerMoveSettled,
      [sessionId]: [...(state.trackerMoveSettled[sessionId] ?? []), key],
    },
  }));
  return fresh.kind === 'open' ? { kind: 'moved', move: settledMove } : { kind: 'already-done' };
};

export const moveTrackerItem =
  ({ set, get }: SliceDeps) =>
  ({ sessionId, key }: MoveTrackerItemParams): Promise<MoveTrackerItemResult> => {
    const flightKey = `${sessionId}:${key}`;
    const running = movesInFlight.get(flightKey);
    if (running !== undefined) {
      return running;
    }
    const started = runMove({ set, get, sessionId, key }).finally(() => {
      movesInFlight.delete(flightKey);
    });
    movesInFlight.set(flightKey, started);
    return started;
  };
