import type { GithubIssue } from '@goodboy/types';
import { issueBranchSlug } from '../../../../../shared/utils/issueBranchSlug';

type BranchParams = {
  readonly issue: Pick<GithubIssue, 'number' | 'title'>;
};

export const githubBranchSlug = ({ issue }: BranchParams): string =>
  issueBranchSlug({ prefix: String(issue.number), title: issue.title });
