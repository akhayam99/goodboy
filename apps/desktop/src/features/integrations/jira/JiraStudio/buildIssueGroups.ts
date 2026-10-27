import type { SessionId } from '@goodboy/types';
import { groupIssuesBy, type IssueGroup } from '../../shared/groupIssuesBy';
import type { JiraIssue, JiraStatusCategoryKey } from '../client';

export type JiraIssueGroup = IssueGroup<JiraStatusCategoryKey, JiraIssue>;

const GROUP_ORDER: ReadonlyArray<JiraStatusCategoryKey> = ['indeterminate', 'new', 'done', ''];

const GROUP_LABEL: Record<JiraStatusCategoryKey, string> = {
  indeterminate: 'In progress',
  new: 'To do',
  done: 'Done',
  '': 'Other',
};

type GroupParams = {
  readonly issues: ReadonlyArray<JiraIssue>;
  readonly sessionIdByExternalId: ReadonlyMap<string, SessionId>;
};

export const buildIssueGroups = ({
  issues,
  sessionIdByExternalId,
}: GroupParams): ReadonlyArray<JiraIssueGroup> =>
  groupIssuesBy({
    issues,
    sessionIdByExternalId,
    externalIdOf: ({ issue }) => issue.id,
    keyOf: ({ issue }) => issue.statusCategory,
    labelOf: ({ key }) => GROUP_LABEL[key],
    updatedAtOf: ({ issue }) => issue.updated,
    order: GROUP_ORDER,
  });
