import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { checkTargetOf, type CheckTarget } from './checkTargetOf';
import { failingChecksOf, type FailingChecks } from './failingChecksOf';

type Params = {
  readonly state: Pick<
    AppState,
    'mountGithub' | 'pullRequestViews' | 'sessionPhaseRuns' | 'transcripts'
  >;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number | null;
};

export type CheckStepTarget = {
  readonly target: CheckTarget | null;
  readonly failing: FailingChecks | null;
};

export const checkStepTargetOf = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): CheckStepTarget => {
  const failing =
    prNumber === null ? null : failingChecksOf({ state, sessionId, mountId, prNumber });
  const check = failing?.checks[0];
  const target = checkTargetOf({
    state,
    sessionId,
    mountId,
    failingUrl: check === undefined ? null : (check.detailsUrl ?? failing?.pullRequest.url ?? null),
    failingName: check?.name ?? null,
  });
  return { target, failing };
};
