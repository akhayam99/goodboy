import type {
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { pullRequestViewAt } from '../../../store/slices/pull-request-view/pullRequestViewAt';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'mountGithub' | 'pullRequestViews'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number;
};

export type FailingChecks = {
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly allChecks: ReadonlyArray<PrCheckRun>;
};

const FAILED = ['failure', 'timed_out', 'cancelled'];

export const failingChecksOf = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): FailingChecks | null => {
  const github = state.mountGithub[mountId];
  const portView = pullRequestViewAt({ state, sessionId, mountId, prNumber })?.view ?? null;
  const pullRequest = github?.pr ?? portView;
  const detail = github?.detail;
  const checks =
    detail?.prNumber === pullRequest?.number
      ? detail?.checks
      : portView?.number === pullRequest?.number
        ? portView?.checks.runs
        : undefined;
  if (pullRequest === undefined || pullRequest === null || pullRequest.number !== prNumber) {
    return null;
  }
  if (checks === undefined) {
    return null;
  }
  return {
    pullRequest,
    checks: checks.filter((check) => FAILED.includes(check.conclusion)),
    allChecks: checks,
  };
};
