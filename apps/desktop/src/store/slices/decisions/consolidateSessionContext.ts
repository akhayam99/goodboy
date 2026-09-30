import type { SessionId } from '@goodboy/types';
import { enqueueContextConsolidation } from '../turn/turnHelpers';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

export type ConsolidateSessionContextParams = {
  readonly sessionId: SessionId;
  readonly after: string;
};

export const consolidateSessionContext = (set: SetFn, get: GetFn) => {
  return ({ sessionId, after }: ConsolidateSessionContextParams): void => {
    const session = sessionById(get().sessions, sessionId);
    if (session === undefined) {
      return;
    }
    const decisions = get().sessionSlots[sessionId]?.find((slot) => slot.key === 'decisions');
    if (decisions === undefined || decisions.value.trim() === '') {
      return;
    }
    enqueueContextConsolidation({ set, get, sessionId, after });
  };
};
