import { composeGoal } from '../shared/composeGoal';
import type { JiraIssue } from './client';

type Params = {
  readonly issue: JiraIssue;
};

export const goalFromIssue = ({ issue }: Params): string =>
  composeGoal({
    heading: `[${issue.key}] ${issue.summary.trim()}`,
    body: issue.description.trim(),
    source: { noun: 'issue', reference: issue.key, url: issue.url ?? null },
  });
