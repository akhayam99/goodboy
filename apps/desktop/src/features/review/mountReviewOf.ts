import type { MountId, PullRequestState, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectActiveMountId } from '../../store/slices/project-mounts/selectors';
import {
  requestIdentityEquals,
  sessionMountTargets,
} from '../../store/slices/project-mounts/mountRequests';
import { githubRequestIdentity } from '../../store/slices/github/mountPrLink';
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

type ActiveMountParams = MountParams & {
  readonly isActive: boolean;
};

type MountRequest =
  | { readonly kind: 'review'; readonly target: ReviewTarget }
  | { readonly kind: 'onHost'; readonly url: string | null };

const NO_CHOICES: ReadonlyArray<ReviewTarget> = [];

const githubRequestOf = ({
  state,
  sessionId,
  mountId,
  isActive,
}: ActiveMountParams): PullRequestState | null => {
  const own = state.mountGithub[mountId];
  if (own === undefined) {
    return isActive ? (state.sessionGithub[sessionId]?.pr ?? null) : null;
  }
  const selected = state.mountSelectedPr[mountId] ?? null;
  const repository = own.repository;
  if (selected === null || repository === null) {
    return own.pr;
  }
  return (
    own.prs.find((candidate) =>
      requestIdentityEquals({
        identity: selected,
        candidate: githubRequestIdentity({ repository, pr: candidate }),
      }),
    ) ?? own.pr
  );
};

const mountRequestOf = ({ state, sessionId, mountId }: MountParams): MountRequest | null => {
  const isActive = selectActiveMountId({ state, sessionId }) === mountId;
  const pullRequest = githubRequestOf({ state, sessionId, mountId, isActive });
  const github =
    pullRequest == null
      ? null
      : targetFromUrl({ provider: 'github', url: pullRequest.url, prNumber: pullRequest.number });
  if (github !== null) {
    return { kind: 'review', target: github };
  }
  const gitlabEntry = gitlabMountOf({ state, mountId });
  const mergeRequest =
    gitlabEntry !== undefined
      ? gitlabEntry.mr
      : isActive
        ? (gitlabSessionOf({ state, sessionId })?.mr ?? null)
        : null;
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

const mountReposOf = ({ state, sessionId, mountId }: MountParams): ReadonlySet<string> => {
  const repos = [
    state.mountGithub[mountId]?.repository ?? null,
    gitlabMountOf({ state, mountId })?.projectPath ?? null,
    sessionMountTargets({ state, sessionId }).find((target) => target.id === mountId)?.repoSlug ??
      null,
  ];
  return new Set(
    repos.flatMap((repo) => (repo === null || repo === '' ? [] : [repo.toLowerCase()])),
  );
};

const mountLinkedTargetsOf = ({
  state,
  sessionId,
  mountId,
}: MountParams): ReadonlyArray<ReviewTarget> => {
  const repos = mountReposOf({ state, sessionId, mountId });
  return linkedReviewTargetsOf({ state, sessionId }).filter((target) =>
    repos.has(target.repo.toLowerCase()),
  );
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
        : mountLinkedTargetsOf({ state, sessionId, mountId });
  const chosen = state.reviewSubmission[sessionId]?.chosenTarget ?? null;
  const target = choices.find((choice) => choice === chosen) ?? choices[0] ?? null;
  if (target === null) {
    return { kind: 'none', target: null, choices: NO_CHOICES, hostUrl: null };
  }
  return { kind: 'review', target, choices, hostUrl: null };
};
