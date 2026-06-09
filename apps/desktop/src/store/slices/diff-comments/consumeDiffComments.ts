import {
  consumeDiffComments as dbConsumeDiffComments,
  listDiffCommentsForSession,
} from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const consumeDiffComments = (set: SetFn) => {
  return async (sessionId: SessionId, commentIds: ReadonlyArray<string>, agentId: AgentId) => {
    if (commentIds.length === 0) return;
    await dbConsumeDiffComments(tauriDatabase, commentIds, agentId);
    const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
    set((state) => ({
      diffComments: { ...state.diffComments, [sessionId]: comments },
    }));
  };
};
