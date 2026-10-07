import type { SessionId, WorkspaceId } from '@goodboy/types';
import { sessionById } from '../sessions/sessionIndex';
import { changeSessionPins, type PinsChange } from './changeSessionPins';
import { addPin, removePin } from './pinsChanges';
import { readSessionPins } from './readSessionPins';
import { sessionPinsInitialState, type SessionPin } from './state';
import type { GetFn, SessionPinsSlice, SetFn } from './types';
import type { SliceDeps } from '../../slice-types';

const EMPTY_PINS: ReadonlyArray<SessionPin> = [];

type StoreParams = {
  readonly set: SetFn;
  readonly workspaceId: WorkspaceId;
  readonly pins: ReadonlyArray<SessionPin>;
};

type WorkspaceOfParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

type ApplyParams = {
  readonly sessionId: SessionId;
  readonly change: (params: { readonly now: number }) => PinsChange;
  readonly failureTitle: string;
};

const isSamePins = ({
  first,
  second,
}: {
  readonly first: ReadonlyArray<SessionPin>;
  readonly second: ReadonlyArray<SessionPin>;
}): boolean =>
  first.length === second.length &&
  first.every((pin, index) => pin.id === second[index]?.id && pin.at === second[index]?.at);

const storePins = ({ set, workspaceId, pins }: StoreParams): void =>
  set((state) => {
    const previous = state.sessionPins[workspaceId] ?? EMPTY_PINS;
    if (isSamePins({ first: previous, second: pins })) {
      return state;
    }
    return { sessionPins: { ...state.sessionPins, [workspaceId]: pins } };
  });

const workspaceOf = ({ get, sessionId }: WorkspaceOfParams): WorkspaceId | null => {
  const state = get();
  const session =
    sessionById(state.sessions, sessionId) ??
    sessionById(Object.values(state.archivedSessions).flat(), sessionId);
  return (session?.workspaceId as WorkspaceId | undefined) ?? state.currentWorkspaceId;
};

export const createSessionPinsSlice = ({ set, get }: SliceDeps): SessionPinsSlice => {
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };

  const syncFromDatabase = async ({ workspaceId }: { readonly workspaceId: WorkspaceId }) => {
    const { pins } = await readSessionPins({ workspaceId });
    storePins({ set, workspaceId, pins });
  };

  const apply = ({ sessionId, change, failureTitle }: ApplyParams): Promise<void> =>
    enqueue(async () => {
      const workspaceId = workspaceOf({ get, sessionId });
      if (workspaceId === null) {
        return;
      }
      try {
        const pins = await changeSessionPins({
          workspaceId,
          change: change({ now: Date.now() }),
        });
        if (pins === null) {
          throw new Error('The list of pinned sessions kept changing while it was saved');
        }
        storePins({ set, workspaceId, pins });
      } catch (error) {
        void get().reportError({ title: failureTitle, error, workspaceId });
        await syncFromDatabase({ workspaceId }).catch(() => undefined);
      }
    });

  return {
    ...sessionPinsInitialState,
    loadSessionPins: ({ workspaceId }) => enqueue(() => syncFromDatabase({ workspaceId })),
    pinSession: (sessionId) =>
      apply({
        sessionId,
        change: ({ now }) => addPin({ sessionId, now }),
        failureTitle: "Couldn't pin the session",
      }),
    unpinSession: (sessionId) =>
      apply({
        sessionId,
        change: () => removePin({ sessionId }),
        failureTitle: "Couldn't unpin the session",
      }),
  };
};
