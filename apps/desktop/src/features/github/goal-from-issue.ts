import type { GithubIssue } from '@goodboy/types';
import { capText } from '../../shared/utils/capText';
import { GOAL_BODY_CHAR_CAP } from '../integrations/shared/goalBodyCap';

type Params = {
  readonly issue: GithubIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const reference = `GitHub issue #${issue.number}: ${issue.title}`;
  const body = issue.body.trim();
  return body === ''
    ? reference
    : `${reference}\n\n${capText({ text: body, capChars: GOAL_BODY_CHAR_CAP })}`;
};
