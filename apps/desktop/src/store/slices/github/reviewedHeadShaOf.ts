import type { MountId, PullRequestState, SessionId } from '@goodboy/types';
import { sessionPullRequestOf, type RequestState } from '../review-source/sessionPullRequestOf';

type Params = {
  readonly state: RequestState;
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
  readonly prNumber: number;
};

export const reviewedHeadShaOf = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): string | null => {
  const mountPrs: ReadonlyArray<PullRequestState> =
    mountId === undefined ? [] : (state.mountGithub?.[mountId]?.prs ?? []);
  const shown = sessionPullRequestOf({
    state,
    sessionId,
    mountId: mountId ?? null,
    prNumber,
  });
  const candidates = shown === null ? mountPrs : [shown, ...mountPrs];
  return candidates.find((candidate) => candidate.number === prNumber)?.headSha ?? null;
};
