import type { GithubIssue } from '@goodboy/types';
import { composeGoal } from '../integrations/shared/composeGoal';

type Params = {
  readonly issue: GithubIssue;
};

export const goalFromIssue = ({ issue }: Params): string =>
  composeGoal({
    heading: `GitHub issue #${issue.number}: ${issue.title}`,
    body: issue.body.trim(),
    source: { noun: 'issue', reference: `#${issue.number}`, url: issue.url },
  });
