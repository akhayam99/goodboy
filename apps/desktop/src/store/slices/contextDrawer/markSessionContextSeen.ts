import type { IsoDateTime, SessionId } from '@goodboy/types';
import { getSessionContextSeenAt, setSessionContextSeenAt } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

const previousSeenAt = async ({
  get,
  sessionId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
}): Promise<IsoDateTime | null> => {
  const known = get().sessionContextSeenAt[sessionId];
  if (known !== undefined) {
    return known;
  }
  return getSessionContextSeenAt(tauriDatabase, sessionId).catch(() => null);
};

export const markSessionContextSeen = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const baseline = await previousSeenAt({ get, sessionId });
    const seenAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [sessionId]: seenAt },
      sessionDecisionsBaseline: { ...state.sessionDecisionsBaseline, [sessionId]: baseline },
    }));
    await setSessionContextSeenAt(tauriDatabase, sessionId, seenAt).catch(() => undefined);
  };
};
