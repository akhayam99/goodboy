import { getSetting } from '@goodboy/db';
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
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const editPostedReplies = async ({ get, sessionId }: Params): Promise<number> => {
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
    edited += 1;
  }
  return edited;
};
