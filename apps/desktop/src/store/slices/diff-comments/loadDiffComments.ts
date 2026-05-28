import { listDiffCommentsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { diffCommentsInFlight, type GetFn, type SetFn } from './types';

export function loadDiffComments(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    // Cache hit short-circuit: ContextPanel mounts on every session switch
    // and fires this effect; without the guard the ~1s DB query repeats
    // even when the data is already in store. Mutations (add/resolve/delete)
    // refresh the slice directly, so the cache stays accurate.
    if (get().diffComments[sessionId] !== undefined) return;
    // In-flight dedup: a second mount before the first DB query lands would
    // also pass the cache check above and double the work. The Set blocks it.
    if (diffCommentsInFlight.has(sessionId)) return;
    diffCommentsInFlight.add(sessionId);
    try {
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    } finally {
      diffCommentsInFlight.delete(sessionId);
    }
  };
}
