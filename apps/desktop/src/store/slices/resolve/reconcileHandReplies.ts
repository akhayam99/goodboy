import { listResolveAttempts, listResolveThreads, setResolveThreadReplyPosted } from '@goodboy/db';
import type { PrComment, ResolveThread } from '@goodboy/types';
import { groupThreads } from '../../../features/integrations/github/comment-threads';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectResolveRows } from './projectResolveRows';
import { viewerLoginsOf } from './viewerLogins';
import type { SessionParams, SliceParams } from './types';

type Params = SliceParams &
  SessionParams & {
    readonly prNumber: number;
    readonly comments: ReadonlyArray<PrComment>;
  };

export const normalizedReplyBody = ({ body }: { readonly body: string }): string =>
  body.replace(/\s+/g, ' ').trim();

type MatchParams = {
  readonly row: ResolveThread;
  readonly comments: ReadonlyArray<PrComment>;
  readonly viewerLogins: ReadonlySet<string>;
};

const handReplyOf = ({ row, comments, viewerLogins }: MatchParams): PrComment | null => {
  const draft = normalizedReplyBody({ body: row.replyDraft ?? '' });
  if (draft === '') {
    return null;
  }
  const thread = groupThreads(comments.filter((comment) => comment.threadId === row.threadId))[0];
  return (
    thread?.replies.find(
      (reply) =>
        viewerLogins.has(reply.author.toLowerCase()) &&
        normalizedReplyBody({ body: reply.body }) === draft,
    ) ?? null
  );
};

export const reconcileHandReplies = async ({
  set,
  get,
  sessionId,
  prNumber,
  comments,
}: Params): Promise<number> => {
  const viewerLogins = viewerLoginsOf({ state: get() });
  if (viewerLogins.size === 0) {
    return 0;
  }
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  let marked = 0;
  for (const row of rows) {
    if (row.prNumber !== prNumber || row.replyPostedAt !== null || row.state === 'closed') {
      continue;
    }
    const reply = handReplyOf({ row, comments, viewerLogins });
    if (reply === null) {
      continue;
    }
    const isMarked = await setResolveThreadReplyPosted({
      db,
      sessionId,
      threadId: row.threadId,
      replyId: reply.id,
      postedAt: new Date(reply.createdAt).getTime(),
    });
    marked += isMarked ? 1 : 0;
  }
  if (marked === 0) {
    return 0;
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
  return marked;
};
