import type { GithubIssue, GithubIssueComment } from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { runJson } from './gh';

const ISSUE_FIELDS = [
  'number',
  'title',
  'body',
  'url',
  'state',
  'labels',
  'assignees',
  'updatedAt',
] as const;

type RawGithubIssue = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  labels: ReadonlyArray<{ name: string }>;
  assignees: ReadonlyArray<{ login: string }>;
  updatedAt: string;
};

type UpdateIssueBodyParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly issueNumber: number;
  readonly body: string;
  readonly opts?: GhRunOptions;
};

type RawUpdatedIssue = {
  body: string | null;
};

export const updateIssueBody = async ({
  runner,
  repoSlug,
  issueNumber,
  body,
  opts = {},
}: UpdateIssueBodyParams): Promise<string> => {
  const updated = await runJson<RawUpdatedIssue>(
    runner,
    ['api', `repos/${repoSlug}/issues/${issueNumber}`, '-X', 'PATCH', '-f', `body=${body}`],
    opts,
  );
  return updated.body ?? '';
};

type RawIssueComment = {
  id: number;
  user: { login: string; avatar_url: string | null } | null;
  body: string | null;
  created_at: string;
  html_url: string;
};

type ToIssueCommentParams = {
  readonly raw: RawIssueComment;
};

const toIssueComment = ({ raw }: ToIssueCommentParams): GithubIssueComment => ({
  id: String(raw.id),
  author: raw.user?.login ?? 'unknown',
  authorAvatarUrl: raw.user?.avatar_url ?? null,
  body: raw.body ?? '',
  createdAt: raw.created_at,
  url: raw.html_url,
});

type ListIssueCommentsParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly issueNumber: number;
  readonly opts?: GhRunOptions;
};

export const listIssueComments = async ({
  runner,
  repoSlug,
  issueNumber,
  opts = {},
}: ListIssueCommentsParams): Promise<ReadonlyArray<GithubIssueComment>> => {
  const raw = await runJson<ReadonlyArray<RawIssueComment>>(
    runner,
    ['api', `repos/${repoSlug}/issues/${issueNumber}/comments`, '--paginate'],
    opts,
  );
  return raw.map((comment) => toIssueComment({ raw: comment }));
};

type CreateIssueCommentParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly issueNumber: number;
  readonly body: string;
  readonly opts?: GhRunOptions;
};

export const createIssueComment = async ({
  runner,
  repoSlug,
  issueNumber,
  body,
  opts = {},
}: CreateIssueCommentParams): Promise<GithubIssueComment> => {
  const raw = await runJson<RawIssueComment>(
    runner,
    ['api', `repos/${repoSlug}/issues/${issueNumber}/comments`, '-X', 'POST', '-f', `body=${body}`],
    opts,
  );
  return toIssueComment({ raw });
};

export const listAssignedIssues = async (
  runner: GhRunner,
  repoSlug: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<GithubIssue>> => {
  const issues = await runJson<ReadonlyArray<RawGithubIssue>>(
    runner,
    [
      'issue',
      'list',
      '--repo',
      repoSlug,
      '--assignee',
      '@me',
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      ISSUE_FIELDS.join(','),
    ],
    opts,
  );

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body ?? '',
    url: issue.url,
    state: issue.state,
    labels: issue.labels.map((label) => label.name),
    updatedAt: issue.updatedAt,
  }));
};
