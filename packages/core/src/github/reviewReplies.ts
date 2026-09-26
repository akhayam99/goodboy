import { runJson, type GhRunOptions, type GhRunner } from './gh';

export type ReviewReply = {
  readonly body: string;
  readonly createdAt: string;
};

type RawUser = { readonly login?: string };

type RawSearchItem = { readonly number?: number; readonly updated_at?: string };

type RawSearch = { readonly items?: ReadonlyArray<RawSearchItem> };

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
  readonly pullsPerPage?: number;
  readonly maxPages?: number;
  readonly opts?: GhRunOptions;
};

export const REVIEW_REPLY_SAMPLE_SIZE = 20;

const newestCutoff = ({
  replies,
  limit,
}: {
  readonly replies: ReadonlyArray<ReviewReply>;
  readonly limit: number;
}): string | null => {
  if (replies.length < limit) {
    return null;
  }
  const newest = replies.map((reply) => reply.createdAt).sort((a, b) => b.localeCompare(a));
  return newest[limit - 1] ?? null;
};

export const listMyReviewReplies = async ({
  runner,
  repoSlugs,
  limit = REVIEW_REPLY_SAMPLE_SIZE,
  pullsPerPage = 10,
  maxPages = 5,
  opts = {},
}: Params): Promise<ReadonlyArray<ReviewReply>> => {
  const user = await runJson<RawUser>({ runner, args: ['api', 'user'], opts, shape: 'object' });
  const login = user.login ?? '';
  if (login === '') {
    return [];
  }
  const replies: Array<ReviewReply> = [];
  const collect = async ({
    slug,
    number,
  }: {
    readonly slug: string;
    readonly number: number;
  }): Promise<void> => {
    const comments = await runJson<ReadonlyArray<RawReviewComment>>({
      runner,
      args: ['api', `repos/${slug}/pulls/${number}/comments`, '--paginate'],
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
  };
  for (const slug of repoSlugs) {
    for (let page = 1; page <= maxPages; page += 1) {
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
          `per_page=${pullsPerPage}`,
          '-f',
          `page=${page}`,
        ],
        opts,
        shape: 'object',
      });
      const items = search.items ?? [];
      let isOlderThanSample = false;
      for (const item of items) {
        const cutoff = newestCutoff({ replies, limit });
        if (cutoff !== null && (item.updated_at ?? '') < cutoff) {
          isOlderThanSample = true;
          break;
        }
        if (item.number !== undefined) {
          await collect({ slug, number: item.number });
        }
      }
      if (isOlderThanSample || items.length < pullsPerPage) {
        break;
      }
    }
  }
  return [...replies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
};
