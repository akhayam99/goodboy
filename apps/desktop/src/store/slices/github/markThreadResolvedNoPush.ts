import { resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { postThreadReply } from './postThreadReply';
import { sessionThreadGhOptions } from './sessionThreadGhOptions';
import type { GetFn, SetFn } from './types';

type Closure = { commitSha?: string; reason?: string; reply?: string };

export const markThreadResolvedNoPush = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  threadId: string,
  closure?: Closure,
): Promise<void> => {
  await postThreadReply({ get, sessionId, threadId, closure });
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
