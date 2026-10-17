import type { PrCheckRun, PrDetail, PullRequestState, PullRequestView } from '@goodboy/types';
import { checksRunsOf } from '../integrations/github/checksRollup';

type Params = {
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
};

export const pullRequestRunsOf = ({
  pr,
  detail,
  view,
}: Params): ReadonlyArray<PrCheckRun> | null => {
  const fromDetail = checksRunsOf({ pr, detail });
  if (fromDetail !== null) {
    return fromDetail;
  }
  if (pr === null || pr.checksUnknown === true || view === null || view.checks.read !== 'ok') {
    return null;
  }
  return view.checks.runs;
};
