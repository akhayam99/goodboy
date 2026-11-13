import type { PrCheckRun, PullRequestReviewer, PullRequestReviewerState } from '@goodboy/types';
import { checksSummaryOf } from '../../../github/checksRollup';
import { linkedIssuesOfBody } from '../../../components/HostOverview/linkedIssuesOfBody';
import type { HostRailFacts } from '../../../components/HostOverview/types';
import type { BitbucketParticipant, BitbucketPullRequest } from '../../client';

type Params = {
  readonly pullRequest: BitbucketPullRequest;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

type ParticipantParams = {
  readonly participant: BitbucketParticipant;
};

const stateOf = ({ participant }: ParticipantParams) => {
  if (participant.approved) {
    return 'approved' satisfies PullRequestReviewerState;
  }
  if (participant.state === 'changes_requested') {
    return 'changes_requested' satisfies PullRequestReviewerState;
  }
  return 'pending' satisfies PullRequestReviewerState;
};

type RequestParams = {
  readonly pullRequest: BitbucketPullRequest;
};

const reviewersOf = ({ pullRequest }: RequestParams): ReadonlyArray<PullRequestReviewer> =>
  pullRequest.participants.flatMap((participant) =>
    participant.role === 'REVIEWER' && participant.user !== null
      ? [
          {
            person: {
              login: participant.user.displayName,
              name: participant.user.displayName,
              avatarUrl: participant.user.avatarUrl,
            },
            state: stateOf({ participant }),
          },
        ]
      : [],
  );

export const bitbucketPrRailOf = ({ pullRequest, checks }: Params): HostRailFacts => ({
  author:
    pullRequest.author === null
      ? null
      : { login: pullRequest.author.displayName, avatarUrl: pullRequest.author.avatarUrl },
  reviewers: reviewersOf({ pullRequest }),
  checks: checksSummaryOf({ runs: checks.length === 0 ? null : checks }),
  linked: linkedIssuesOfBody({ body: pullRequest.description }),
});
