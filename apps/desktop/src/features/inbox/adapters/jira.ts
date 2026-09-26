import { jiraStateCategory } from '../../../shared/detail-fields/jiraIssueFields';
import type { JiraIssueGroup } from '../../integrations/jira/JiraStudio/useJiraIssues';
import type { InboxRecord } from '../types';
type Params = { readonly groups: ReadonlyArray<JiraIssueGroup> };
export const adaptJiraIssues = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `jira:issue:${issue.id}`,
      provider: 'jira',
      kind: 'issue',
      identifier: issue.key,
      title: issue.summary,
      state: jiraStateCategory({ statusCategory: issue.statusCategory }),
      stateLabel: issue.status,
      updatedAt: issue.updated,
      url: issue.url,
      context: issue.issueType,
      payload: { provider: 'jira', kind: 'issue', issue, sessionId },
    })),
  );
