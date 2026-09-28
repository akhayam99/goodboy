import type { PullRequestStateKind } from '@goodboy/types';
import { githubStateCategory } from '../../../shared/detail-fields/githubIssueFields';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import type { GithubIssueGroup } from '../../github/components/PullRequest/useGithubIssues';
import type { GithubPrGroup } from '../../github/components/PullRequest/useGithubPrs';
import type { InboxRecord, InboxState } from '../types';
import { stateWord } from '../stateWord';

type Params = { readonly groups: ReadonlyArray<GithubIssueGroup> };

type PrParams = { readonly groups: ReadonlyArray<GithubPrGroup> };

type RepoParams = {
  readonly url: string;
};

const repoOf = ({ url }: RepoParams): string => {
  const match = /github\.com\/([^/]+\/[^/]+)/.exec(url);
  return match?.[1] ?? '';
};

type PrStateParams = { readonly state: PullRequestStateKind };

const prState = ({ state }: PrStateParams): InboxState =>
  state === 'merged' || state === 'closed' ? 'done' : 'open';

export const adaptGithubIssues = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ issue, sessionId }) => ({
      key: `github:issue:${issue.number}`,
      provider: 'github',
      kind: 'issue',
      identifier: `#${issue.number}`,
      title: issue.title,
      state: githubStateCategory({ state: issue.state }),
      stateLabel: stateWord({ value: issue.state }),
      updatedAt: issue.updatedAt,
      url: issue.url,
      context: repoOf({ url: issue.url }),
      payload: { provider: 'github', kind: 'issue', issue, sessionId },
    })),
  );

export const adaptGithubPrs = ({ groups }: PrParams): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ pr, role, sessionId }) => ({
      key: `github:pr:${pr.number}`,
      provider: 'github',
      kind: 'pr',
      identifier: `#${pr.number}`,
      title: pr.title,
      state: prState({ state: pr.state }),
      stateLabel: PULL_REQUEST_PRESENTATION[pr.state].label,
      updatedAt: pr.updatedAt,
      url: pr.url,
      context: repoOf({ url: pr.url }),
      payload: { provider: 'github', kind: 'pr', pr, role, sessionId },
    })),
  );
