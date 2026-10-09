import type { IsoDateTime } from '@goodboy/types';
import type { NotePullRequestEditParams, SetFn } from './types';

type Params = NotePullRequestEditParams & {
  readonly set: SetFn;
};

export const notePullRequestEdit = ({ set, sessionId, prNumber, what }: Params): void =>
  set((state) => {
    const current = state.pullRequestViews[sessionId];
    const same = current !== undefined && current.prNumber === prNumber ? current : null;
    const edit = { what, at: new Date().toISOString() as IsoDateTime };
    return {
      pullRequestViews: {
        ...state.pullRequestViews,
        [sessionId]: {
          prNumber,
          view: same?.view ?? null,
          isLoading: same?.isLoading ?? false,
          error: same?.error ?? null,
          fetchedAt: same?.fetchedAt ?? null,
          edits: [...(same?.edits ?? []), edit],
        },
      },
    };
  });
