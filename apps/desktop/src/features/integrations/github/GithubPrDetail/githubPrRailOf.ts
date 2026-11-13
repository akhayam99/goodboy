import type { PullRequestState } from '@goodboy/types';
import { linkedIssuesOfBody } from '../../components/HostOverview/linkedIssuesOfBody';
import type { HostRailFacts } from '../../components/HostOverview/types';

type Params = {
  readonly pr: PullRequestState;
};

export const githubPrRailOf = ({ pr }: Params): HostRailFacts => ({
  author: pr.author ?? null,
  reviewers: [],
  checks: null,
  linked: linkedIssuesOfBody({ body: pr.body }),
});
