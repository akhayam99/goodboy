import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

type FactoryParams = {
  readonly get: GetFn;
};

export const markSessionsRead = ({ get }: FactoryParams) => {
  return async ({ sessionIds }: Params): Promise<void> => {
    await Promise.all(sessionIds.map((sessionId) => get().markAllAgentsSeen(sessionId)));
  };
};
