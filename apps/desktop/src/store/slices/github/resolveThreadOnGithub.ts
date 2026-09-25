import { resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { sessionThreadGhOptions } from './sessionThreadGhOptions';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const GITHUB_KEPT_THREAD_OPEN = 'GitHub did not resolve the thread';

export const resolveThreadOnGithub = async ({
  get,
  sessionId,
  threadId,
}: Params): Promise<void> => {
  const thread = await resolveReviewThread(
    tauriGhRunner,
    threadId,
    sessionThreadGhOptions({ get, sessionId }),
  );
  if (!thread.isResolved) {
    throw new Error(GITHUB_KEPT_THREAD_OPEN);
  }
};
