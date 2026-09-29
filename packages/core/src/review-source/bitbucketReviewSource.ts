import type { PrComment } from '@goodboy/types';
import { commitLinkOf } from './commitLink';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSource, type ReviewSourceThread } from './types';

export const BITBUCKET_THREAD_PREFIX = 'bitbucket:';

export const BITBUCKET_NO_RESOLVE = 'Bitbucket has no resolve for a comment thread';

export type BitbucketReviewComment = Readonly<{
  id: number;
  body: string;
  user: Readonly<{ nickname: string; displayName: string; avatarUrl: string | null }> | null;
  createdOn: string;
  deleted: boolean;
  parentId: number | null;
  inline: Readonly<{ path: string; from: number | null; to: number | null }> | null;
  webUrl: string | null;
}>;

export type BitbucketReviewTransport = Readonly<{
  listComments: () => Promise<ReadonlyArray<BitbucketReviewComment>>;
  replyToComment: (params: {
    readonly parentCommentId: number;
    readonly body: string;
  }) => Promise<number>;
  readHeadSha: () => Promise<string | null>;
}>;

type Params = Readonly<{
  transport: BitbucketReviewTransport;
  prUrl: string | null;
}>;

export const bitbucketThreadId = ({ commentId }: { readonly commentId: number | string }): string =>
  `${BITBUCKET_THREAD_PREFIX}${commentId}`;

export const bitbucketCommentId = ({ threadId }: { readonly threadId: string }): string =>
  threadId.startsWith(BITBUCKET_THREAD_PREFIX)
    ? threadId.slice(BITBUCKET_THREAD_PREFIX.length)
    : threadId;

const rootOf = ({
  comment,
  byId,
}: {
  readonly comment: BitbucketReviewComment;
  readonly byId: ReadonlyMap<number, BitbucketReviewComment>;
}): number => {
  const seen = new Set<number>();
  let current = comment;
  while (current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (parent === undefined) {
      return current.parentId;
    }
    current = parent;
  }
  return current.id;
};

type CommentParams = Readonly<{
  comment: BitbucketReviewComment;
  threadId: string;
  fallbackInline: BitbucketReviewComment['inline'];
  prUrl: string | null;
}>;

const commentOf = ({ comment, threadId, fallbackInline, prUrl }: CommentParams): PrComment => {
  const inline = comment.inline ?? fallbackInline;
  const line = inline?.to ?? inline?.from ?? null;
  return {
    id: String(comment.id),
    author: comment.user?.nickname ?? comment.user?.displayName ?? 'unknown',
    authorAvatarUrl: comment.user?.avatarUrl ?? null,
    body: comment.body,
    createdAt: comment.createdOn,
    url: comment.webUrl ?? (prUrl === null ? '' : `${prUrl}#comment-${comment.id}`),
    source: 'review',
    ...(inline !== null && inline.path !== '' && { path: inline.path }),
    ...(line !== null && { line }),
    resolved: false,
    outdated: false,
    threadId,
    canResolve: false,
  };
};

export const bitbucketThreadsOf = ({
  comments,
  prUrl,
}: {
  readonly comments: ReadonlyArray<BitbucketReviewComment>;
  readonly prUrl: string | null;
}): ReadonlyArray<ReviewSourceThread> => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const groups = new Map<number, Array<BitbucketReviewComment>>();
  for (const comment of comments) {
    if (comment.deleted) {
      continue;
    }
    const root = rootOf({ comment, byId });
    groups.set(root, [...(groups.get(root) ?? []), comment]);
  }
  return [...groups.entries()].flatMap(([rootId, members]): ReadonlyArray<ReviewSourceThread> => {
    const head = byId.get(rootId);
    if (head === undefined || head.deleted || head.inline === null) {
      return [];
    }
    const threadId = bitbucketThreadId({ commentId: rootId });
    const ordered = [...members].sort(
      (left, right) =>
        Date.parse(left.createdOn) - Date.parse(right.createdOn) || left.id - right.id,
    );
    return [
      {
        threadId,
        providerThreadId: String(rootId),
        isResolved: false,
        comments: ordered.map((comment) =>
          commentOf({ comment, threadId, fallbackInline: head.inline, prUrl }),
        ),
      },
    ];
  });
};

export const bitbucketReviewSource = ({ transport, prUrl }: Params): ReviewSource => ({
  kind: 'bitbucket',
  capabilities: REVIEW_SOURCE_CAPABILITIES.bitbucket,
  listThreads: async () => bitbucketThreadsOf({ comments: await transport.listComments(), prUrl }),
  reply: async ({ providerThreadId, body }) => {
    const id = await transport.replyToComment({
      parentCommentId: Number(providerThreadId),
      body,
    });
    return { id: String(id) };
  },
  resolve: async () => {
    throw new Error(BITBUCKET_NO_RESOLVE);
  },
  readRemoteHead: () => transport.readHeadSha(),
  commitLink: ({ sha }) => commitLinkOf({ kind: 'bitbucket', url: prUrl, sha }),
});
