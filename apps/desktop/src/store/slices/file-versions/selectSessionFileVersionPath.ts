import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  relativePath: string | null;
}>;

export const selectSessionFileVersionPath = (set: SetFn) => {
  return ({ sessionId, relativePath }: Params): void => {
    set((state) => ({
      sessionFileVersionSelectedPath: {
        ...state.sessionFileVersionSelectedPath,
        [sessionId]: relativePath,
      },
    }));
  };
};
