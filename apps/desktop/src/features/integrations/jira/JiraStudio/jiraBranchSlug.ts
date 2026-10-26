import { issueBranchSlug } from '../../../../shared/utils/issueBranchSlug';
import type { JiraIssue } from '../client';

type BranchSlugParams = {
  readonly issue: JiraIssue;
};

export const jiraBranchSlug = ({ issue }: BranchSlugParams): string =>
  issueBranchSlug({ prefix: issue.key, title: issue.summary });
