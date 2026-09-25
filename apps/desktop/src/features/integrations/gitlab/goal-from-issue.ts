import { composeGoal } from '../shared/composeGoal';
import { issueIdentifier, type GitlabIssue } from './client';

type Params = {
  readonly issue: GitlabIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const identifier = issueIdentifier(issue);
  return composeGoal({
    heading: `[${identifier}] ${issue.title.trim()}`,
    body: (issue.description ?? '').trim(),
    source: { noun: 'issue', reference: identifier, url: issue.webUrl },
  });
};
