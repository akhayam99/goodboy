import type { PrComment } from '@goodboy/types';
import { commitLinkOf } from './commitLink';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSource, type ReviewSourceThread } from './types';

export const GITLAB_THREAD_PREFIX = 'gitlab:';

export type GitlabReviewNote = Readonly<{
  id: number;
  body: string;
  system: boolean;
  author: Readonly<{ username: string; name: string; avatarUrl: string | null }> | null;
  createdAt: string;
  resolvable: boolean;
  resolved: boolean | null;
  position: Readonly<{
    newPath: string | null;
    oldPath: string | null;
    newLine: number | null;
    oldLine: number | null;
  }> | null;
}>;

export type GitlabReviewDiscussion = Readonly<{
  id: string;
  individualNote: boolean;
  notes: ReadonlyArray<GitlabReviewNote>;
}>;

export type GitlabReviewTransport = Readonly<{
  listDiscussions: () => Promise<ReadonlyArray<GitlabReviewDiscussion>>;
  replyToDiscussion: (params: {
    readonly discussionId: string;
    readonly body: string;
  }) => Promise<number>;
  resolveDiscussion: (params: {
    readonly discussionId: string;
    readonly resolved: boolean;
  }) => Promise<GitlabReviewDiscussion>;
  readHeadSha: () => Promise<string | null>;
}>;

type Params = Readonly<{
  transport: GitlabReviewTransport;
  mrUrl: string | null;
}>;

export const gitlabThreadId = ({ discussionId }: { readonly discussionId: string }): string =>
  `${GITLAB_THREAD_PREFIX}${discussionId}`;

export const gitlabDiscussionId = ({ threadId }: { readonly threadId: string }): string =>
  threadId.startsWith(GITLAB_THREAD_PREFIX)
    ? threadId.slice(GITLAB_THREAD_PREFIX.length)
    : threadId;

const isDiscussionResolved = ({
  discussion,
}: {
  readonly discussion: GitlabReviewDiscussion;
}): boolean => {
  const resolvable = discussion.notes.filter((note) => !note.system && note.resolvable);
  return resolvable.length > 0 && resolvable.every((note) => note.resolved === true);
};

type CommentParams = Readonly<{
  note: GitlabReviewNote;
  threadId: string;
  isResolved: boolean;
  mrUrl: string | null;
}>;

const commentOf = ({ note, threadId, isResolved, mrUrl }: CommentParams): PrComment => {
  const path = note.position?.newPath ?? note.position?.oldPath ?? null;
  const line = note.position?.newLine ?? note.position?.oldLine ?? null;
  return {
    id: String(note.id),
    author: note.author?.username ?? note.author?.name ?? 'unknown',
    authorAvatarUrl: note.author?.avatarUrl ?? null,
    body: note.body,
    createdAt: note.createdAt,
    url: mrUrl === null ? '' : `${mrUrl}#note_${note.id}`,
    source: 'review',
    ...(path !== null && path !== '' && { path }),
    ...(line !== null && { line }),
    resolved: isResolved,
    outdated: false,
    threadId,
    canResolve: true,
  };
};

export const gitlabThreadsOf = ({
  discussions,
  mrUrl,
}: {
  readonly discussions: ReadonlyArray<GitlabReviewDiscussion>;
  readonly mrUrl: string | null;
}): ReadonlyArray<ReviewSourceThread> =>
  discussions.flatMap((discussion): ReadonlyArray<ReviewSourceThread> => {
    const notes = discussion.notes.filter((note) => !note.system);
    if (!notes.some((note) => note.resolvable)) {
      return [];
    }
    const threadId = gitlabThreadId({ discussionId: discussion.id });
    const isResolved = isDiscussionResolved({ discussion });
    return [
      {
        threadId,
        providerThreadId: discussion.id,
        isResolved,
        comments: notes.map((note) => commentOf({ note, threadId, isResolved, mrUrl })),
      },
    ];
  });

export const gitlabReviewSource = ({ transport, mrUrl }: Params): ReviewSource => ({
  kind: 'gitlab',
  capabilities: REVIEW_SOURCE_CAPABILITIES.gitlab,
  listThreads: async () =>
    gitlabThreadsOf({ discussions: await transport.listDiscussions(), mrUrl }),
  reply: async ({ providerThreadId, body }) => {
    const id = await transport.replyToDiscussion({ discussionId: providerThreadId, body });
    return { id: String(id) };
  },
  resolve: async ({ providerThreadId }) => {
    const discussion = await transport.resolveDiscussion({
      discussionId: providerThreadId,
      resolved: true,
    });
    return { isResolved: isDiscussionResolved({ discussion }) };
  },
  readRemoteHead: () => transport.readHeadSha(),
  commitLink: ({ sha }) => commitLinkOf({ kind: 'gitlab', url: mrUrl, sha }),
});
