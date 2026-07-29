import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export const selectSessionPr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number): Promise<void> => {
    const pr = (get().sessionGithubPrs[sessionId] ?? []).find(
      (candidate) => candidate.number === prNumber,
    );
    if (pr == null) {
      return;
    }
    const current = get().sessionGithub[sessionId];
    if (current == null || current.pr?.number === prNumber) {
      return;
    }
    set((state) => {
      const existing = state.sessionGithub[sessionId];
      if (existing == null) {
        return state;
      }
      return {
        sessionGithub: {
          ...state.sessionGithub,
          [sessionId]: { ...existing, pr, detail: null, detailFetchedAt: null },
        },
      };
    });
    await get().refreshSessionPrDetail(sessionId, { force: true });
  };
};
