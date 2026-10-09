import type { IsoDateTime } from '@goodboy/types';
import { entryMountIdOf } from './entryMountId';
import type { NotePullRequestEditParams, SetFn } from './types';

type Params = NotePullRequestEditParams & {
  readonly set: SetFn;
};

export const notePullRequestEdit = ({ set, sessionId, prNumber, mountId, what }: Params): void =>
  set((state) => {
    const entryMount = entryMountIdOf({ state, sessionId, mountId });
    const current = state.pullRequestViews[sessionId];
    const same =
      current !== undefined && current.prNumber === prNumber && current.mountId === entryMount
        ? current
        : null;
    const edit = { what, at: new Date().toISOString() as IsoDateTime };
    return {
      pullRequestViews: {
        ...state.pullRequestViews,
        [sessionId]: {
          prNumber,
          mountId: entryMount,
          view: same?.view ?? null,
          isLoading: same?.isLoading ?? false,
          error: same?.error ?? null,
          fetchedAt: same?.fetchedAt ?? null,
          edits: [...(same?.edits ?? []), edit],
        },
      },
    };
  });
