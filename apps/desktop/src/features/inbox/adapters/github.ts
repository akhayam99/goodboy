import type { GithubIssueGroup } from '../../github/components/GitHubStudio/useGithubIssues';
import type { InboxRecord } from '../types';

type Params = { readonly groups: ReadonlyArray<GithubIssueGroup> };

type RepoParams = {
  readonly url: string;
};

const repoOf = ({ url }: RepoParams): string => {
  const match = /github\.com\/([^/]+\/[^/]+)/.exec(url);
  return match?.[1] ?? '';
};

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
      meta: repoOf({ url: issue.url }),
      payload: { provider: 'github', kind: 'issue', issue, sessionId },
    })),
  );
