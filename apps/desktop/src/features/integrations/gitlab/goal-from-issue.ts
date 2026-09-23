import { capText } from '../../../shared/utils/capText';
import { GOAL_BODY_CHAR_CAP } from '../shared/goalBodyCap';
import { issueIdentifier, type GitlabIssue } from './client';

type Params = {
  readonly issue: GitlabIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const heading = `[${issueIdentifier(issue)}] ${issue.title.trim()}`;
  const description = (issue.description ?? '').trim();
  if (description === '') {
    return heading;
  }
  return `${heading}\n\n${capText({ text: description, capChars: GOAL_BODY_CHAR_CAP })}`;
};
