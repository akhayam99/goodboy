import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly pullRequestId: number;
  readonly write: () => Promise<void>;
};

export const runBitbucketPrWrite = async ({
  set,
  get,
  sessionId,
  pullRequestId,
  write,
}: Params): Promise<void> => {
  await write();
  set((state) => ({
    sessionSelectedBitbucketPrId: {
      ...state.sessionSelectedBitbucketPrId,
      [sessionId]: pullRequestId,
    },
  }));
  await get().refreshSessionBitbucketPr(sessionId, { force: true });
};
