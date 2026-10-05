import { insertArtifactComment } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshArtifactComments } from './refresh';
import type { AddArtifactCommentParams, SetFn } from './types';

export const addArtifactComment = (set: SetFn) => {
  return async ({
    sessionId,
    artifactId,
    revision,
    anchor,
    body,
  }: AddArtifactCommentParams): Promise<string | null> => {
    const text = body.trim();
    if (text.length === 0) {
      return null;
    }
    const id = crypto.randomUUID();
    await insertArtifactComment({
      db: tauriDatabase,
      id,
      sessionId,
      artifactId,
      revision,
      anchor,
      body: text,
    });
    await refreshArtifactComments({ set, sessionId });
    return id;
  };
};
