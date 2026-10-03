import type { SessionId } from '@goodboy/types';
import { enqueueContextConsolidation } from './turnHelpers';
import type { GetFn, SetFn } from './types';

export const CONTEXT_UPDATE_REASON = 'you asked for an update';

export const requestContextUpdate = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId) => {
    enqueueContextConsolidation({
      set,
      get,
      sessionId,
      after: CONTEXT_UPDATE_REASON,
      isRequested: true,
    });
  };
};
