import { capText } from '../../../shared/utils/capText';
import { GOAL_BODY_CHAR_CAP } from '../shared/goalBodyCap';
import type { BitbucketPullRequest } from './client';

type Params = {
  readonly pullRequest: BitbucketPullRequest;
};

export const goalFromPullRequest = ({ pullRequest }: Params): string => {
  const reference = `Bitbucket pull request #${pullRequest.id}: ${pullRequest.title}`;
  const description = pullRequest.description.trim();
  return description === ''
    ? reference
    : `${reference}\n\n${capText({ text: description, capChars: GOAL_BODY_CHAR_CAP })}`;
};
