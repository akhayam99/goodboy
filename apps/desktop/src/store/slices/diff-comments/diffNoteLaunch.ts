import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type SliceParams = {
  readonly set: SetFn;
};

export type ShowDiffNoteLaunchParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export type CloseDiffNoteLaunchParams = {
  readonly sessionId: SessionId;
};

export const showDiffNoteLaunch =
  ({ set }: SliceParams) =>
  ({ sessionId, threadIds }: ShowDiffNoteLaunchParams): void => {
    set((state) => ({ diffNoteLaunch: { ...state.diffNoteLaunch, [sessionId]: threadIds } }));
  };

export const closeDiffNoteLaunch =
  ({ set }: SliceParams) =>
  ({ sessionId }: CloseDiffNoteLaunchParams): void => {
    set((state) => {
      if (state.diffNoteLaunch[sessionId] === undefined) {
        return state;
      }
      const { [sessionId]: _closed, ...rest } = state.diffNoteLaunch;
      return { diffNoteLaunch: rest };
    });
  };
