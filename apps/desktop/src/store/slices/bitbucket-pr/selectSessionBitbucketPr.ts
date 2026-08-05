import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export const selectSessionBitbucketPr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, pullRequestId: number | null) => {
    set((state) => ({
      sessionSelectedBitbucketPrId: {
        ...state.sessionSelectedBitbucketPrId,
        [sessionId]: pullRequestId,
      },
    }));
    await get().refreshSessionBitbucketPr(sessionId, { force: true });
  };
};
