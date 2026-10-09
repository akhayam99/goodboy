import type { SessionId } from '@goodboy/types';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import type { AppState } from '../../types';
import type { BranchTab } from '../navigation/types';

type State = Pick<AppState, 'branchTab' | 'sessionGithub'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const branchHasPullRequest = ({
  state,
  sessionId,
}: {
  readonly state: Pick<AppState, 'sessionGithub'>;
  readonly sessionId: SessionId;
}): boolean => (state.sessionGithub?.[sessionId]?.pr ?? null) !== null;

export const branchTabOf = ({ state, sessionId }: Params): BranchTab =>
  state.branchTab?.[sessionId] ??
  branchLandingTabOf({
    hasPullRequest: branchHasPullRequest({ state, sessionId }),
    deepLink: null,
  });
