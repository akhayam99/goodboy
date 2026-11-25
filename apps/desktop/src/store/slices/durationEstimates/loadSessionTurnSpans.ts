import { listSessionTurnSpans } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadSessionTurnSpansParams, SetFn } from './types';

const loading = new Set<string>();
const reloadAfter = new Set<string>();

export const loadSessionTurnSpans = (set: SetFn) => {
  const load = async ({ sessionId }: LoadSessionTurnSpansParams): Promise<void> => {
    if (loading.has(sessionId)) {
      reloadAfter.add(sessionId);
      return;
    }
    loading.add(sessionId);
    try {
      const spans = await listSessionTurnSpans({ db: tauriDatabase, sessionId });
      set((state) => ({
        sessionTurnSpans: { ...state.sessionTurnSpans, [sessionId]: spans },
      }));
    } catch (error) {
      console.error('turn spans load failed', error);
    } finally {
      loading.delete(sessionId);
    }
    if (reloadAfter.delete(sessionId)) {
      await load({ sessionId });
    }
  };
  return load;
};
