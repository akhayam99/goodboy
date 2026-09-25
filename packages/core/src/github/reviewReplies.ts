import { runJson, type GhRunOptions, type GhRunner } from './gh';

export type ReviewReply = {
  readonly body: string;
  readonly createdAt: string;
};

type RawUser = { readonly login?: string };

type RawSearch = { readonly items?: ReadonlyArray<{ readonly number?: number }> };

type RawReviewComment = {
  readonly user?: RawUser | null;
  readonly body?: string | null;
  readonly created_at?: string;
  readonly in_reply_to_id?: number | null;
};

type Params = {
  readonly runner: GhRunner;
  readonly repoSlugs: ReadonlyArray<string>;
  readonly limit?: number;
  readonly pullsPerRepo?: number;
  readonly opts?: GhRunOptions;
};

export const REVIEW_REPLY_SAMPLE_SIZE = 20;

export const listMyReviewReplies = async ({
  runner,
  repoSlugs,
  limit = REVIEW_REPLY_SAMPLE_SIZE,
  pullsPerRepo = 10,
  opts = {},
}: Params): Promise<ReadonlyArray<ReviewReply>> => {
  const user = await runJson<RawUser>({ runner, args: ['api', 'user'], opts, shape: 'object' });
  const login = user.login ?? '';
  if (login === '') {
    return [];
  }
  const replies: Array<ReviewReply> = [];
  for (const slug of repoSlugs) {
    const search = await runJson<RawSearch>({
      runner,
      args: [
        'api',
        '-X',
        'GET',
        'search/issues',
        '-f',
        `q=repo:${slug} type:pr commenter:${login}`,
        '-f',
        'sort=updated',
        '-f',
        `per_page=${pullsPerRepo}`,
      ],
      opts,
      shape: 'object',
    });
    for (const item of search.items ?? []) {
      if (item.number === undefined) {
        continue;
      }
      const comments = await runJson<ReadonlyArray<RawReviewComment>>({
        runner,
        args: ['api', `repos/${slug}/pulls/${item.number}/comments`, '--paginate'],
        opts,
        shape: 'array',
      });
      for (const comment of comments) {
        const body = comment.body?.trim() ?? '';
        if (comment.user?.login !== login || comment.in_reply_to_id == null || body === '') {
          continue;
        }
        replies.push({ body, createdAt: comment.created_at ?? '' });
      }
    }
  }
  return [...replies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
};
