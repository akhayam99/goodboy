import { updateArtifactCommentBody } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshArtifactComments } from './refresh';
import type { EditArtifactCommentParams, SetFn } from './types';

export const editArtifactComment = (set: SetFn) => {
  return async ({ sessionId, commentId, body }: EditArtifactCommentParams): Promise<boolean> => {
    const text = body.trim();
    if (text.length === 0) {
      return false;
    }
    const isUpdated = await updateArtifactCommentBody({
      db: tauriDatabase,
      id: commentId,
      body: text,
    });
    await refreshArtifactComments({ set, sessionId });
    return isUpdated;
  };
};
