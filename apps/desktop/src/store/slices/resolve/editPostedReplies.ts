import {
  getSetting,
  listResolvePublicationThreads,
  listResolvePublicationsForSession,
  upsertResolvePublicationThread,
} from '@goodboy/db';
import { updateReviewComment } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import {
  editPostedReplyKey,
  isEditPostedReplyOn,
} from '../../../features/resolve/editPostedReplySetting';
import { replyUpdateLine } from '../../../features/resolve/replyUpdateLine';
import { threadFixSha } from '../../../features/resolve/threadFixSha';
import { insertBeforeAttribution } from '../../../shared/utils/attribution';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitLink } from '../github/buildResolutionReplyBody';
import { sessionThreadGhOptions } from '../github/sessionThreadGhOptions';
import { readCommitStory, recordReplyEdit } from './commitStory';
import { publicationTarget } from './publicationTarget';
import { loadPublicationsInto } from './publicationState';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

type ReceiptParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly replyId: string;
  readonly body: string;
};

const rewriteReceiptBodies = async ({
  sessionId,
  threadId,
  replyId,
  body,
}: ReceiptParams): Promise<void> => {
  const publications = await listResolvePublicationsForSession({
    db: tauriDatabase,
    sessionId,
  });
  for (const publication of publications) {
    const receipts = await listResolvePublicationThreads({
      db: tauriDatabase,
      publicationId: publication.id,
    });
    for (const receipt of receipts) {
      if (receipt.threadId === threadId && receipt.replyId === replyId) {
        await upsertResolvePublicationThread({
          db: tauriDatabase,
          thread: { ...receipt, replyBody: body },
        });
      }
    }
  }
};

export const editPostedReplies = async ({ set, get, sessionId }: Params): Promise<number> => {
  const workspaceId = get().sessions.find((session) => session.id === sessionId)?.workspaceId;
  if (workspaceId === undefined) {
    return 0;
  }
  const raw = await getSetting(tauriDatabase, editPostedReplyKey({ workspaceId }));
  if (!isEditPostedReplyOn({ raw })) {
    return 0;
  }
  const { prUrl } = publicationTarget({ get, sessionId });
  const options = sessionThreadGhOptions({ get, sessionId });
  let edited = 0;
  for (const row of get().sessionResolveThreads[sessionId] ?? []) {
    if (row.replyId === null || row.replyPostedAt === null) {
      continue;
    }
    const story = await readCommitStory({ sessionId, threadId: row.threadId });
    const finalSha = threadFixSha({ commitShas: row.commitShas });
    if (story.reply === null || finalSha === null || finalSha === story.reply.sha) {
      continue;
    }
    const line = replyUpdateLine({
      from: commitLink({ sha: story.reply.sha, prUrl }),
      to: commitLink({ sha: finalSha, prUrl }),
      isFolded: story.isFolded && story.originalSha === story.reply.sha,
    });
    const body = insertBeforeAttribution({
      body: story.reply.body,
      text: [...story.reply.lines, line].join('\n\n'),
    });
    try {
      await updateReviewComment(tauriGhRunner, row.replyId, body, options);
    } catch {
      continue;
    }
    await recordReplyEdit({ sessionId, threadId: row.threadId, sha: finalSha, line });
    await rewriteReceiptBodies({
      sessionId,
      threadId: row.threadId,
      replyId: row.replyId,
      body,
    }).catch(() => undefined);
    edited += 1;
  }
  if (edited > 0) {
    await loadPublicationsInto({ set, sessionId });
  }
  return edited;
};
