import type { SessionId } from '@goodboy/types';
import { recordOutcome } from './recordOutcome';
import type { GetFn, SetFn } from './types';

export function dismissSessionNudge(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, outcome: 'accepted' | 'dismissed' = 'dismissed') => {
    const nudge = get().sessionNudges[sessionId] ?? null;
    if (!nudge) return;
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: null },
    }));
    await recordOutcome(nudge.id, outcome);
  };
}
