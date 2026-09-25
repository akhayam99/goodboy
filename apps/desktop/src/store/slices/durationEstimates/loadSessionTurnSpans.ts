import { listSessionTurnSpans } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadSessionTurnSpansParams, SetFn } from './types';

export const loadSessionTurnSpans =
  (set: SetFn) =>
  async ({ sessionId }: LoadSessionTurnSpansParams): Promise<void> => {
    try {
      const spans = await listSessionTurnSpans({ db: tauriDatabase, sessionId });
      set((state) => ({
        sessionTurnSpans: { ...state.sessionTurnSpans, [sessionId]: spans },
      }));
    } catch (error) {
      console.error('turn spans load failed', error);
    }
  };
