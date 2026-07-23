import type { GithubIssue } from '@goodboy/types';

type Params = {
  readonly issue: GithubIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const reference = `GitHub issue #${issue.number}: ${issue.title}`;
  const body = issue.body.trim();
  return body === '' ? reference : `${reference}\n\n${body}`;
};
