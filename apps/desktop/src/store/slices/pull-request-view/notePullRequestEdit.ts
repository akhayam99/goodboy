import type { IsoDateTime } from '@goodboy/types';
import { entryMountIdOf } from './entryMountId';
import { pullRequestViewAt, withPullRequestViewEntry } from './pullRequestViewAt';
import type { NotePullRequestEditParams, SetFn } from './types';

type Params = NotePullRequestEditParams & {
  readonly set: SetFn;
};

export const notePullRequestEdit = ({ set, sessionId, prNumber, mountId, what }: Params): void =>
  set((state) => {
    const entryMount = entryMountIdOf({ state, sessionId, mountId });
    const same = pullRequestViewAt({ state, sessionId, mountId: entryMount, prNumber });
    const edit = { what, at: new Date().toISOString() as IsoDateTime };
    return {
      pullRequestViews: withPullRequestViewEntry({
        views: state.pullRequestViews,
        sessionId,
        entry: {
          prNumber,
          mountId: entryMount,
          view: same?.view ?? null,
          isLoading: same?.isLoading ?? false,
          error: same?.error ?? null,
          fetchedAt: same?.fetchedAt ?? null,
          edits: [...(same?.edits ?? []), edit],
        },
      }),
    };
  });
