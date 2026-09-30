import { getSetting, setSetting } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type PostedReplyStory = {
  readonly sha: string;
  readonly body: string;
  readonly lines: ReadonlyArray<string>;
};

export type ThreadCommitStory = {
  readonly originalSha: string | null;
  readonly isFolded: boolean;
  readonly reply: PostedReplyStory | null;
};

type ThreadParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const EMPTY: ThreadCommitStory = { originalSha: null, isFolded: false, reply: null };

const keyOf = ({ sessionId, threadId }: ThreadParams): string =>
  `resolve.commit_story.${sessionId}.${threadId}`;

const isReply = (value: unknown): value is PostedReplyStory =>
  typeof value === 'object' &&
  value !== null &&
  'sha' in value &&
  typeof value.sha === 'string' &&
  'body' in value &&
  typeof value.body === 'string' &&
  'lines' in value &&
  Array.isArray(value.lines) &&
  value.lines.every((line) => typeof line === 'string');

const parse = ({ raw }: { readonly raw: string | null }): ThreadCommitStory => {
  if (raw === null) {
    return EMPTY;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return EMPTY;
    }
    return {
      originalSha:
        'originalSha' in value && typeof value.originalSha === 'string' ? value.originalSha : null,
      isFolded: 'isFolded' in value && value.isFolded === true,
      reply: 'reply' in value && isReply(value.reply) ? value.reply : null,
    };
  } catch {
    return EMPTY;
  }
};

export const readCommitStory = async ({
  sessionId,
  threadId,
}: ThreadParams): Promise<ThreadCommitStory> =>
  parse({ raw: await getSetting(tauriDatabase, keyOf({ sessionId, threadId })) });

const writeCommitStory = async ({
  sessionId,
  threadId,
  story,
}: ThreadParams & { readonly story: ThreadCommitStory }): Promise<void> => {
  await setSetting(tauriDatabase, keyOf({ sessionId, threadId }), JSON.stringify(story));
};

type MoveParams = ThreadParams & {
  readonly fromSha: string;
  readonly isFolded: boolean;
};

export const recordCommitMove = async ({
  sessionId,
  threadId,
  fromSha,
  isFolded,
}: MoveParams): Promise<void> => {
  const story = await readCommitStory({ sessionId, threadId });
  await writeCommitStory({
    sessionId,
    threadId,
    story: {
      ...story,
      originalSha: story.originalSha ?? fromSha,
      isFolded: story.isFolded || isFolded,
    },
  });
};

type PostedParams = ThreadParams & {
  readonly sha: string;
  readonly body: string;
};

export const recordPostedReply = async ({
  sessionId,
  threadId,
  sha,
  body,
}: PostedParams): Promise<void> => {
  await writeCommitStory({
    sessionId,
    threadId,
    story: { originalSha: null, isFolded: false, reply: { sha, body, lines: [] } },
  });
};

type EditedParams = ThreadParams & {
  readonly sha: string;
  readonly line: string;
};

export const recordReplyEdit = async ({
  sessionId,
  threadId,
  sha,
  line,
}: EditedParams): Promise<void> => {
  const story = await readCommitStory({ sessionId, threadId });
  if (story.reply === null) {
    return;
  }
  await writeCommitStory({
    sessionId,
    threadId,
    story: {
      originalSha: null,
      isFolded: false,
      reply: { ...story.reply, sha, lines: [...story.reply.lines, line] },
    },
  });
};
