import type { PullRequestChecks, SessionId } from '@goodboy/types';
import { gitlabSessionOf } from '../../../store/slices/mount-request/requestOf';
import { resolveSessionRequest } from '../../../store/slices/session-view/resolveSessionRequest';
import { sessionStageRequestOf } from '../../../store/slices/session-view/sessionStageRequest';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const requestChecksOf = ({ state, sessionId }: Params): PullRequestChecks => {
  const staged = sessionStageRequestOf({ state, sessionId });
  if (staged !== null) {
    return staged.pr.checks;
  }
  const { pr } = resolveSessionRequest({
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    mr: gitlabSessionOf({ state, sessionId })?.mr ?? null,
  });
  return pr?.checks ?? null;
};
