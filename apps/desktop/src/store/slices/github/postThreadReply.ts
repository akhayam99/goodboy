import { addReviewThreadReply } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';
import { resolverReplyForThread } from './resolverReplyForThread';
import { sessionThreadGhOptions } from './sessionThreadGhOptions';
import type { GetFn } from './types';

type Closure = { commitSha?: string; reason?: string; reply?: string };

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly closure?: Closure;
};

const firstFilled = ({
  candidates,
}: {
  readonly candidates: ReadonlyArray<string | null | undefined>;
}): string | null => {
  for (const candidate of candidates) {
    const text = candidate?.trim() ?? '';
    if (text !== '') {
      return text;
    }
  }
  return null;
};

export const postThreadReply = async ({
  get,
  sessionId,
  threadId,
  closure,
}: Params): Promise<boolean> => {
  const pendingReply = get().sessionPendingResolutions[sessionId]?.find(
    (resolution) => resolution.threadId === threadId,
  )?.reply;
  const reply = firstFilled({
    candidates: [
      closure?.reply,
      pendingReply,
      resolverReplyForThread(get().resolverThreadOutcomes, threadId),
    ],
  });
  const pr = get().sessionGithub[sessionId]?.pr ?? null;
  const replyBody = buildResolutionReplyBody(
    reply === null ? closure : { ...closure, reply },
    pr?.url ?? null,
  );
  if (replyBody === null) {
    return false;
  }
  await addReviewThreadReply(
    tauriGhRunner,
    threadId,
    replyBody,
    sessionThreadGhOptions({ get, sessionId }),
  );
  return true;
};
