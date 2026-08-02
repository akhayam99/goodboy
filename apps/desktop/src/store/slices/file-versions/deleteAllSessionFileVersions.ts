import type { SessionId } from '@goodboy/types';
import { purgeSessionFileVersions } from './persistFinalizedFileVersions';
import type { SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
}>;

export const deleteAllSessionFileVersions = (set: SetFn) => {
  return async ({ sessionId }: Params): Promise<void> => {
    await purgeSessionFileVersions({ sessionId });
    set((state) => ({
      sessionFileVersions: {
        ...state.sessionFileVersions,
        [sessionId]: [],
      },
      sessionFileVersionSelectedPath: {
        ...state.sessionFileVersionSelectedPath,
        [sessionId]: null,
      },
    }));
  };
};
