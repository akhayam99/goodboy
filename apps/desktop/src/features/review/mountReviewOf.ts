import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectActiveMountId } from '../../store/slices/project-mounts/selectors';
import { selectActiveProjectPrs } from '../../store/slices/github/activeProjectPrs';
import {
  bitbucketSessionOf,
  gitlabMountOf,
  gitlabSessionOf,
} from '../../store/slices/mount-request/requestOf';
import { selectBitbucketRequest } from '../../store/slices/mount-request/selectBitbucketRequest';
import {
  linkedReviewTargetsOf,
  sessionReviewTargetsOf,
  targetFromUrl,
  type ReviewTarget,
} from '../../store/slices/review-drafts/resolveReviewTarget';

export type MountReview = {
  readonly kind: 'review' | 'onHost' | 'none';
  readonly target: ReviewTarget | null;
  readonly choices: ReadonlyArray<ReviewTarget>;
  readonly hostUrl: string | null;
};

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

type MountParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type MountRequest =
  | { readonly kind: 'review'; readonly target: ReviewTarget }
  | { readonly kind: 'onHost'; readonly url: string | null };

const NO_CHOICES: ReadonlyArray<ReviewTarget> = [];

const mountRequestOf = ({ state, sessionId, mountId }: MountParams): MountRequest | null => {
  const isActive = selectActiveMountId({ state, sessionId }) === mountId;
  const pullRequest =
    state.mountGithub[mountId]?.pr ??
    (isActive
      ? (state.sessionGithub[sessionId]?.pr ?? selectActiveProjectPrs({ state, sessionId })[0])
      : null) ??
    null;
  const github =
    pullRequest == null
      ? null
      : targetFromUrl({ provider: 'github', url: pullRequest.url, prNumber: pullRequest.number });
  if (github !== null) {
    return { kind: 'review', target: github };
  }
  const mergeRequest =
    gitlabMountOf({ state, mountId })?.mr ??
    (isActive ? gitlabSessionOf({ state, sessionId })?.mr : null) ??
    null;
  const gitlab =
    mergeRequest == null
      ? null
      : targetFromUrl({ provider: 'gitlab', url: mergeRequest.webUrl, prNumber: mergeRequest.iid });
  if (gitlab !== null) {
    return { kind: 'review', target: gitlab };
  }
  const bitbucket =
    selectBitbucketRequest({ state, sessionId, mountId })?.pr ??
    (isActive ? bitbucketSessionOf({ state, sessionId })?.pr : null) ??
    null;
  return bitbucket === null ? null : { kind: 'onHost', url: bitbucket.webUrl };
};

export const mountReviewOf = ({ state, sessionId, mountId }: Params): MountReview => {
  const own = mountId === null ? null : mountRequestOf({ state, sessionId, mountId });
  if (own?.kind === 'onHost') {
    return { kind: 'onHost', target: null, choices: NO_CHOICES, hostUrl: own.url };
  }
  const choices =
    own !== null
      ? [own.target]
      : mountId === null
        ? sessionReviewTargetsOf({ state, sessionId })
        : linkedReviewTargetsOf({ state, sessionId });
  const chosen = state.reviewSubmission[sessionId]?.chosenTarget ?? null;
  const target = choices.find((choice) => choice === chosen) ?? choices[0] ?? null;
  if (target === null) {
    return { kind: 'none', target: null, choices: NO_CHOICES, hostUrl: null };
  }
  return { kind: 'review', target, choices, hostUrl: null };
};
