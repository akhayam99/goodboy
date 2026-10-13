import type { IsoDateTime, SessionId } from '@goodboy/types';
import { setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly readAt: IsoDateTime;
};

type Deps = {
  readonly set: SetFn;
};

export const markContextRead = ({ set }: Deps) => {
  return async ({ sessionId, readAt }: Params): Promise<void> => {
    await setSessionContextSeenAt(tauriDatabase, sessionId, readAt);
    set((state) => {
      const current = state.sessionContextSeenAt[sessionId];
      if (typeof current === 'string' && current > readAt) {
        return {};
      }
      return {
        sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: readAt },
        sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: readAt },
      };
    });
  };
};
