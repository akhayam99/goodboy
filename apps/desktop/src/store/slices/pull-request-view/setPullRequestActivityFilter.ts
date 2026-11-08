import { pullRequestViewAt, withPullRequestViewEntry } from './pullRequestViewAt';
import type { SetFn, SetPullRequestActivityFilterParams } from './types';

type Params = {
  readonly set: SetFn;
};

export const setPullRequestActivityFilter =
  ({ set }: Params) =>
  ({ sessionId, prNumber, mountId, filter }: SetPullRequestActivityFilterParams): void =>
    set((state) => {
      const same = pullRequestViewAt({ state, sessionId, mountId, prNumber });
      if (same === null) {
        return {};
      }
      return {
        pullRequestViews: withPullRequestViewEntry({
          views: state.pullRequestViews,
          sessionId,
          entry: { ...same, activityFilter: filter },
        }),
      };
    });
