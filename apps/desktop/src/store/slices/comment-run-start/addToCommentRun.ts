import { addAgentSourceThread, removeAgentSourceThread } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { COMMENT_RUN_COPY } from '../../../features/resolve/commentRunCopy';
import { commentRunOf } from '../../../features/resolve/commentRunOf';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import type { SliceDeps } from '../../slice-types';
import { queueCommentRunMessage } from './queueCommentRunMessage';
import type { AddToCommentRunParams } from './types';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type MessageParams = {
  readonly quote: string;
};

const messageOf = ({ quote }: MessageParams): string =>
  [COMMENT_RUN_COPY.addedMessage, quote].filter((part) => part.trim() !== '').join('\n\n');

export const addToCommentRun = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, agentId, threadId, quote }: AddToCommentRunParams): Promise<void> => {
    const agents = get().sessionPhaseRuns[sessionId] ?? NO_AGENTS;
    if (commentRunOf({ agents, threadId }) !== null) {
      throw new Error(COMMENT_RUN_COPY.inRun);
    }
    const isLinked = await addAgentSourceThread({ db: tauriDatabase, id: agentId, threadId });
    if (!isLinked) {
      throw new Error(COMMENT_RUN_COPY.runEnded);
    }
    const isSaved = await queueCommentRunMessage({
      set,
      get,
      agentId,
      content: messageOf({ quote }),
    });
    if (!isSaved) {
      await removeAgentSourceThread({ db: tauriDatabase, id: agentId, threadId });
      throw new Error(COMMENT_RUN_COPY.notSaved);
    }
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? NO_AGENTS).map((agent) =>
          agent.id === agentId
            ? { ...agent, sourceThreadIds: [...new Set([...agentThreadIds(agent), threadId])] }
            : agent,
        ),
      },
    }));
  };
};
