import type { PullRequestReviewer } from '@goodboy/types';
import { isBotLogin } from './isBotLogin';

export type PullRequestReviewerGroups = {
  readonly people: ReadonlyArray<PullRequestReviewer>;
  readonly bots: ReadonlyArray<PullRequestReviewer>;
};

type Params = {
  readonly reviewers: ReadonlyArray<PullRequestReviewer>;
};

const ORDER: Readonly<Record<PullRequestReviewer['state'], number>> = {
  pending: 0,
  changes_requested: 1,
  approved: 2,
  commented: 3,
  dismissed: 4,
};

type ReviewerParams = {
  readonly reviewer: PullRequestReviewer;
};

const isBotComment = ({ reviewer }: ReviewerParams): boolean =>
  reviewer.state === 'commented' && isBotLogin({ login: reviewer.person.login });

export const pullRequestReviewerGroupsOf = ({ reviewers }: Params): PullRequestReviewerGroups => {
  const people = reviewers
    .map((reviewer, index) => ({ reviewer, index }))
    .filter(({ reviewer }) => !isBotComment({ reviewer }))
    .sort((left, right) => {
      const byState = ORDER[left.reviewer.state] - ORDER[right.reviewer.state];
      if (byState !== 0) {
        return byState;
      }
      return left.index - right.index;
    })
    .map(({ reviewer }) => reviewer);
  return { people, bots: reviewers.filter((reviewer) => isBotComment({ reviewer })) };
};
