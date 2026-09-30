import type { PullRequestState } from '@goodboy/types';
import { composeGoal } from '../shared/composeGoal';

type Params = {
  readonly pr: PullRequestState;
};

export const goalFromPullRequest = ({ pr }: Params): string =>
  composeGoal({
    heading: `GitHub pull request #${pr.number}: ${pr.title}`,
    body: pr.body.trim(),
    source: { noun: 'pull request', reference: `#${pr.number}`, url: pr.url },
  });
