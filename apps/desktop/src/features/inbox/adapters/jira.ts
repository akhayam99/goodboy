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
      state:
        issue.statusCategory === 'done'
          ? 'done'
          : issue.statusCategory === 'indeterminate'
            ? 'active'
            : 'open',
      updatedAt: issue.updated,
      url: issue.url,
      meta: `${issue.issueType} · ${issue.status}`,
      payload: { provider: 'jira', kind: 'issue', issue, sessionId },
    })),
  );
