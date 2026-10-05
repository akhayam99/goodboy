import { listArtifactComments } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const refreshArtifactComments = async ({
  set,
  sessionId,
}: {
  readonly set: SetFn;
  readonly sessionId: SessionId;
}): Promise<void> => {
  const comments = await listArtifactComments({ db: tauriDatabase, sessionId });
  set((state) => ({ artifactComments: { ...state.artifactComments, [sessionId]: comments } }));
};
