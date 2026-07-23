import type { GithubIssue } from '@goodboy/types';
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
