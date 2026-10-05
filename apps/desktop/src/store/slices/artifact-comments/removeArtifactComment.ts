import { deleteArtifactComment, insertArtifactComment } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshArtifactComments } from './refresh';
import type { GetFn, RemoveArtifactCommentParams, SetFn } from './types';

export const removeArtifactComment = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, commentId }: RemoveArtifactCommentParams): Promise<boolean> => {
    const comment = (get().artifactComments[sessionId] ?? []).find(
      (candidate) => candidate.id === commentId,
    );
    if (comment === undefined || comment.status !== 'draft') {
      return false;
    }
    const isDeleted = await deleteArtifactComment({ db: tauriDatabase, id: commentId });
    await refreshArtifactComments({ set, sessionId });
    if (!isDeleted) {
      return false;
    }
    get().undoable({
      message: 'Comment removed',
      conflictMessage: 'This comment was already restored. Nothing changed.',
      undo: async () => {
        const exists = (get().artifactComments[sessionId] ?? []).some(
          (candidate) => candidate.id === commentId,
        );
        if (exists) {
          return false;
        }
        await insertArtifactComment({
          db: tauriDatabase,
          id: comment.id,
          sessionId: comment.sessionId,
          artifactId: comment.artifactId,
          revision: comment.revision,
          anchor: comment.anchor,
          body: comment.body,
          createdAt: Date.parse(comment.createdAt),
        });
        await refreshArtifactComments({ set, sessionId });
        return true;
      },
    });
    return true;
  };
};
