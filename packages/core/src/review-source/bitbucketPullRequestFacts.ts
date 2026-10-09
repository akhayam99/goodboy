import type {
  PullRequestChecks,
  PullRequestReviewDecision,
  PullRequestReviewer,
  PullRequestStateKind,
} from '@goodboy/types';
import type {
  BitbucketPortParticipant,
  BitbucketPortStatus,
  BitbucketPortUser,
  BitbucketPullRequestStateName,
} from './bitbucketPullRequestTypes';

export const BITBUCKET_PR_STATE_KIND = {
  OPEN: 'open',
  MERGED: 'merged',
  DECLINED: 'closed',
  SUPERSEDED: 'closed',
} as const satisfies Readonly<Record<BitbucketPullRequestStateName, PullRequestStateKind>>;

const KIND_BY_RAW_STATE: Readonly<Record<string, PullRequestStateKind>> = BITBUCKET_PR_STATE_KIND;

export const bitbucketPrStateKind = ({ state }: { readonly state: string }): PullRequestStateKind =>
  KIND_BY_RAW_STATE[state] ?? 'open';

const REVIEWER_ROLE = 'REVIEWER';

const reviewersOnly = ({
  participants,
}: {
  readonly participants: ReadonlyArray<BitbucketPortParticipant>;
}): ReadonlyArray<BitbucketPortParticipant> =>
  participants.filter((participant) => participant.role === REVIEWER_ROLE);

const hasApproved = ({
  participant,
}: {
  readonly participant: BitbucketPortParticipant;
}): boolean => participant.approved || participant.state === 'approved';

const hasAskedForChanges = ({
  participant,
}: {
  readonly participant: BitbucketPortParticipant;
}): boolean => participant.state === 'changes_requested';

export const bitbucketChecksOf = ({
  statuses,
}: {
  readonly statuses: ReadonlyArray<Pick<BitbucketPortStatus, 'state'>>;
}): PullRequestChecks => {
  if (statuses.length === 0) {
    return null;
  }
  if (statuses.some((status) => status.state === 'FAILED' || status.state === 'STOPPED')) {
    return 'failure';
  }
  if (statuses.some((status) => status.state === 'INPROGRESS')) {
    return 'pending';
  }
  return statuses.every((status) => status.state === 'SUCCESSFUL') ? 'success' : null;
};

export const bitbucketReviewDecisionOf = ({
  participants,
}: {
  readonly participants: ReadonlyArray<BitbucketPortParticipant>;
}): PullRequestReviewDecision | null => {
  const reviewers = reviewersOnly({ participants });
  if (reviewers.length === 0) {
    return null;
  }
  if (reviewers.some((participant) => hasAskedForChanges({ participant }))) {
    return 'changes_requested';
  }
  return reviewers.some((participant) => hasApproved({ participant }))
    ? 'approved'
    : 'review_required';
};

const personOf = ({
  user,
}: {
  readonly user: BitbucketPortUser;
}): PullRequestReviewer['person'] => ({
  login: user.nickname,
  name: user.displayName === '' ? null : user.displayName,
  avatarUrl: user.avatarUrl,
});

export const bitbucketReviewerUuidsOf = ({
  participants,
}: {
  readonly participants: ReadonlyArray<BitbucketPortParticipant>;
}): ReadonlyArray<string> =>
  reviewersOnly({ participants }).flatMap((participant) =>
    participant.user === null || participant.user.uuid === '' ? [] : [participant.user.uuid],
  );

export const bitbucketReviewersOf = ({
  participants,
}: {
  readonly participants: ReadonlyArray<BitbucketPortParticipant>;
}): ReadonlyArray<PullRequestReviewer> =>
  reviewersOnly({ participants }).flatMap((participant): ReadonlyArray<PullRequestReviewer> => {
    if (participant.user === null) {
      return [];
    }
    const person = personOf({ user: participant.user });
    if (hasAskedForChanges({ participant })) {
      return [{ person, state: 'changes_requested' }];
    }
    return [{ person, state: hasApproved({ participant }) ? 'approved' : 'pending' }];
  });
