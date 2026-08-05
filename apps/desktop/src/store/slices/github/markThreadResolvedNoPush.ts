import { resolveReviewThread } from '@goodboy/core';
import { markPendingResolutionReplyPosted } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { tauriGhRunner } from '../../../features/github/github';
import { postThreadReply } from './postThreadReply';
import { sessionThreadGhOptions } from './sessionThreadGhOptions';
import type { GetFn, SetFn } from './types';

type Closure = { commitSha?: string; reason?: string; reply?: string };

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly replyAlreadyPosted: boolean;
  readonly closure?: Closure;
};

export const markThreadResolvedNoPush = async ({
  set,
  get,
  sessionId,
  threadId,
  replyAlreadyPosted,
  closure,
}: Params): Promise<void> => {
  if (!replyAlreadyPosted) {
    const posted = await postThreadReply({ get, sessionId, threadId, closure });
    if (posted) {
      await markPendingResolutionReplyPosted({ db: tauriDatabase, sessionId, threadId });
    }
  }
  await resolveReviewThread(tauriGhRunner, threadId, sessionThreadGhOptions({ get, sessionId }));
  set((state) => {
    const known = state.sessionResolvedThreads[sessionId] ?? [];
    if (known.includes(threadId)) {
      return {};
    }
    return {
      sessionResolvedThreads: {
        ...state.sessionResolvedThreads,
        [sessionId]: [...known, threadId],
      },
    };
  });
};
