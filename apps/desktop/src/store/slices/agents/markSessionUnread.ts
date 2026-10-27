import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';
import { unreadTargetOf } from './unreadTargetOf';

type Params = {
  readonly sessionId: SessionId;
};

type FactoryParams = {
  readonly get: GetFn;
};

export const markSessionUnread = ({ get }: FactoryParams) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const target = unreadTargetOf({ state: get(), sessionId });
    if (target === null) {
      return;
    }
    await get().markAgentUnviewed({ sessionId, agentId: target.id });
  };
};
