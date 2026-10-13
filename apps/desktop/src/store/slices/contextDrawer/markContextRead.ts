import type { SessionId } from '@goodboy/types';
import { setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { nowIso } from '../project-mounts/mountOperations';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
};

export const markContextRead = (set: SetFn) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const readAt = nowIso();
    await setSessionContextSeenAt(tauriDatabase, sessionId, readAt);
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: readAt },
      sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: readAt },
    }));
  };
};
