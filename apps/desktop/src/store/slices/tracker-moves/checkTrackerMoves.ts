import type { SessionExternalTask, SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { sessionById } from '../sessions/sessionIndex';
import { isSessionShipped } from './isSessionShipped';
import { readTrackerMove } from './readTrackerMove';
import { trackerTasksOf } from './trackerTasksOf';
import type { CheckTrackerMovesParams, TrackerMove, TrackerRead } from './types';

type ReadOutcome = TrackerRead | Readonly<{ kind: 'failed' }>;

type ReadParams = {
  readonly get: SliceDeps['get'];
  readonly task: SessionExternalTask;
  readonly sessionId: SessionId;
};

const readSafely = async ({ get, task, sessionId }: ReadParams): Promise<ReadOutcome> => {
  const session = sessionById(get().sessions, sessionId);
  if (session === undefined) {
    return { kind: 'failed' };
  }
  try {
    return await readTrackerMove({ get, task, workspaceId: session.workspaceId });
  } catch {
    return { kind: 'failed' };
  }
};

type KeepParams = {
  readonly previous: ReadonlyArray<TrackerMove>;
  readonly task: SessionExternalTask;
};

const trackedKeyOf = ({ task }: Pick<KeepParams, 'task'>): string =>
  `${task.provider}:${task.externalId}`;

export const checkTrackerMoves =
  ({ set, get }: SliceDeps) =>
  async ({ sessionId }: CheckTrackerMovesParams): Promise<void> => {
    const nonce = crypto.randomUUID();
    set((state) => ({ trackerMoveChecks: { ...state.trackerMoveChecks, [sessionId]: nonce } }));
    const tasks = isSessionShipped({ state: get(), sessionId })
      ? trackerTasksOf({ state: get(), sessionId })
      : [];
    const outcomes = await Promise.all(tasks.map((task) => readSafely({ get, task, sessionId })));
    if (get().trackerMoveChecks[sessionId] !== nonce) {
      return;
    }
    const previous = get().trackerMoves[sessionId] ?? [];
    const stillOpen = new Set(
      trackerTasksOf({ state: get(), sessionId }).map((task) => trackedKeyOf({ task })),
    );
    const next = tasks.flatMap((task, index): ReadonlyArray<TrackerMove> => {
      const outcome = outcomes[index];
      if (
        !stillOpen.has(trackedKeyOf({ task })) ||
        !isSessionShipped({ state: get(), sessionId })
      ) {
        return [];
      }
      if (outcome?.kind === 'open') {
        return [outcome.move];
      }
      if (outcome?.kind === 'failed') {
        return previous.filter((move) => move.key === trackedKeyOf({ task }));
      }
      return [];
    });
    if (next.length === 0 && previous.length === 0) {
      return;
    }
    set((state) => ({ trackerMoves: { ...state.trackerMoves, [sessionId]: next } }));
  };
