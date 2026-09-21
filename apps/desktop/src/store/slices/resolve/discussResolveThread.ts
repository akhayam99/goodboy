import { addReviewThreadReply } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { sessionThreadGhOptions } from '../github/sessionThreadGhOptions';
import type { SliceParams } from './types';

export const EMPTY_DISCUSSION_REPLY = 'Write the reply the reviewer will read';

type Params = SliceParams & {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly reply: string;
};

export const discussResolveThread = async ({
  get,
  sessionId,
  threadId,
  reply,
}: Params): Promise<void> => {
  if (reply.trim() === '') {
    throw new Error(EMPTY_DISCUSSION_REPLY);
  }
  await addReviewThreadReply(
    tauriGhRunner,
    threadId,
    reply,
    sessionThreadGhOptions({ get, sessionId }),
  );
  await get().refreshSessionPrDetail(sessionId, { force: true });
};
