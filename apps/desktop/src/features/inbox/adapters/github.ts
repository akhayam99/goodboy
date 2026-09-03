import type { GithubIssueGroup } from '../../github/components/GitHubStudio/useGithubIssues';
import type { InboxRecord } from '../types';

type Params = { readonly groups: ReadonlyArray<GithubIssueGroup> };

export const adaptGithubIssues = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `github:issue:${issue.number}`,
      provider: 'github',
      kind: 'issue',
      identifier: `#${issue.number}`,
      title: issue.title,
      state: 'open',
      updatedAt: issue.updatedAt,
      url: issue.url,
      meta: 'GitHub',
      payload: { provider: 'github', kind: 'issue', issue, sessionId },
    })),
  );
