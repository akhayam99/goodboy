import { composeGoal } from '../shared/composeGoal';
import type { LinearIssue } from './client';

type Params = {
  readonly issue: LinearIssue;
};

export const goalFromIssue = ({ issue }: Params): string =>
  composeGoal({
    heading: `[${issue.identifier}] ${issue.title.trim()}`,
    body: (issue.description ?? '').trim(),
    source: { noun: 'issue', reference: issue.identifier, url: issue.url },
  });
