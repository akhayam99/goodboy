import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export const selectSessionPr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number): Promise<void> => {
    const prs = get().sessionGithubPrs[sessionId] ?? [];
    const pr = prs.find((candidate) => candidate.number === prNumber);
    if (pr == null) {
      return;
    }
    const current = get().sessionGithub[sessionId];
    if (current == null) {
      return;
    }
    const selectedNumber = get().sessionSelectedPrNumber[sessionId] ?? null;
    const selectedPr =
      selectedNumber != null
        ? (prs.find((candidate) => candidate.number === selectedNumber) ?? null)
        : null;
    const currentNumber = selectedPr?.number ?? current.pr?.number ?? null;
    if (currentNumber === prNumber) {
      return;
    }
    const nextSelectedNumber = current.pr?.number === prNumber ? null : prNumber;
    set((state) => {
      const existing = state.sessionGithub[sessionId];
      if (existing == null) {
        return state;
      }
      return {
        sessionSelectedPrNumber: {
          ...state.sessionSelectedPrNumber,
          [sessionId]: nextSelectedNumber,
        },
        sessionGithub: {
          ...state.sessionGithub,
          [sessionId]: {
            ...existing,
            linkedIssues: [],
            detail: null,
            detailFetchedAt: null,
            detailLoading: false,
            detailError: null,
          },
        },
      };
    });
    await get().refreshSessionPrDetail(sessionId, { force: true });
  };
};
