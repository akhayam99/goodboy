import { issueBranchSlug } from '../../../../shared/utils/issueBranchSlug';
import type { GitlabIssue } from '../client';

type Params = {
  readonly issue: GitlabIssue;
};

export const gitlabBranchSlug = ({ issue }: Params): string => {
  return issueBranchSlug({ prefix: String(issue.iid), title: issue.title });
};
