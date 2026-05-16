import {
  listDiffCommentsForSession,
  insertDiffComment,
  resolveDiffComment as dbResolveDiffComment,
  consumeDiffComments as dbConsumeDiffComments,
  reopenDiffComment as dbReopenDiffComment,
  deleteDiffComment as dbDeleteDiffComment,
} from '@kay-am/db';
import type { SessionId, AgentId } from '@kay-am/types';
import type { DiffCommentAnchor } from '@kay-am/types';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

// In-flight dedup for actions whose store slice has no native loading flag.
// Prevents the second fetch when ContextPanel's effect fires twice (StrictMode
// remount, or rapid keep-alive activation) before the first round-trip lands.
const diffCommentsInFlight = new Set<SessionId>();

export function createDiffCommentsSlice(set: SetFn, get: GetFn) {
  return {
    loadDiffComments: async (sessionId: SessionId) => {
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
    },

    addDiffComment: async (
      sessionId: SessionId,
      filePath: string,
      body: string,
      anchor?: DiffCommentAnchor,
    ) => {
      const id = crypto.randomUUID();
      await insertDiffComment(tauriDatabase, id, sessionId, filePath, body, anchor);
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    },

    resolveDiffComment: async (sessionId: SessionId, commentId: string) => {
      await dbResolveDiffComment(tauriDatabase, commentId);
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    },

    consumeDiffComments: async (
      sessionId: SessionId,
      commentIds: ReadonlyArray<string>,
      agentId: AgentId,
    ) => {
      if (commentIds.length === 0) return;
      await dbConsumeDiffComments(tauriDatabase, commentIds, agentId);
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    },

    reopenDiffComment: async (sessionId: SessionId, commentId: string) => {
      await dbReopenDiffComment(tauriDatabase, commentId);
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    },

    deleteDiffComment: async (sessionId: SessionId, commentId: string) => {
      await dbDeleteDiffComment(tauriDatabase, commentId);
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }));
    },
  };
}
