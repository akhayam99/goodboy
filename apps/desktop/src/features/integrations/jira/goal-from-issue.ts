import { capText } from '../../../shared/utils/capText';
import { GOAL_BODY_CHAR_CAP } from '../shared/goalBodyCap';
import type { JiraIssue } from './client';

type Params = {
  readonly issue: JiraIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const heading = `[${issue.key}] ${issue.summary.trim()}`;
  const description = issue.description.trim();
  if (description === '') {
    return heading;
  }
  return `${heading}\n\n${capText({ text: description, capChars: GOAL_BODY_CHAR_CAP })}`;
};
