import type { Agent } from '@goodboy/types';
import { COMMENT_RUN_COPY } from '../../../features/resolve/commentRunCopy';
import { commentRunOf } from '../../../features/resolve/commentRunOf';
import type { SliceDeps } from '../../slice-types';
import { queueCommentRunMessage } from './queueCommentRunMessage';
import type { SendChangeToCommentRunParams } from './types';

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const sendChangeToCommentRun = ({ set, get }: SliceDeps) => {
  return async ({
    sessionId,
    agentId,
    threadId,
    quote,
  }: SendChangeToCommentRunParams): Promise<void> => {
    const agents = get().sessionPhaseRuns[sessionId] ?? NO_AGENTS;
    if (commentRunOf({ agents, threadId }) !== agentId) {
      throw new Error(COMMENT_RUN_COPY.runEnded);
    }
    const isSaved = await queueCommentRunMessage({
      set,
      get,
      sessionId,
      agentId,
      content: [COMMENT_RUN_COPY.changedMessage, quote]
        .filter((part) => part.trim() !== '')
        .join('\n\n'),
    });
    if (!isSaved) {
      throw new Error(COMMENT_RUN_COPY.changeNotSaved);
    }
    await get().settleResolveSourceChange({ sessionId, threadId, keepDraft: false });
  };
};
