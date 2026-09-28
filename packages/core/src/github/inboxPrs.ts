import type { GithubInboxPrRole, GithubInboxPullRequest } from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { runJson } from './gh';
import { PR_FIELDS, toPullRequestState, type RawPullRequest } from './resolver';

const INBOX_PR_LIMIT = 50;

const OWN_PR_ACTIVITY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type SinceParams = {
  readonly now: Date;
};

const activitySince = ({ now }: SinceParams): string =>
  new Date(now.getTime() - OWN_PR_ACTIVITY_DAYS * DAY_MS).toISOString().slice(0, 10);

type ListParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly search: string;
  readonly opts: GhRunOptions;
};

const listOpenPrs = async ({
  runner,
  repoSlug,
  search,
  opts,
}: ListParams): Promise<ReadonlyArray<RawPullRequest>> =>
  runJson<ReadonlyArray<RawPullRequest>>({
    runner,
    args: [
      'pr',
      'list',
      '--repo',
      repoSlug,
      '--state',
      'open',
      '--search',
      search,
      '--limit',
      String(INBOX_PR_LIMIT),
      '--json',
      PR_FIELDS.join(','),
    ],
    opts,
    shape: 'array',
  });

type InboxPrsParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly now: Date;
  readonly opts?: GhRunOptions;
};

export const listInboxPullRequests = async ({
  runner,
  repoSlug,
  now,
  opts = {},
}: InboxPrsParams): Promise<ReadonlyArray<GithubInboxPullRequest>> => {
  const [reviewRequested, authored] = await Promise.all([
    listOpenPrs({ runner, repoSlug, search: 'review-requested:@me', opts }),
    listOpenPrs({
      runner,
      repoSlug,
      search: `author:@me updated:>=${activitySince({ now })}`,
      opts,
    }),
  ]);
  const byNumber = new Map<number, GithubInboxPullRequest>();
  const tagged: ReadonlyArray<readonly [RawPullRequest, GithubInboxPrRole]> = [
    ...reviewRequested.map((raw) => [raw, 'review-requested'] as const),
    ...authored.map((raw) => [raw, 'author'] as const),
  ];
  for (const [raw, role] of tagged) {
    if (byNumber.has(raw.number)) {
      continue;
    }
    byNumber.set(raw.number, { pr: toPullRequestState({ raw }), role });
  }
  return [...byNumber.values()].sort((left, right) =>
    right.pr.updatedAt.localeCompare(left.pr.updatedAt),
  );
};
