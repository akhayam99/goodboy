import type { SessionId } from '@goodboy/types';
import { refreshArtifactComments } from './refresh';
import { settleStaleSentComments } from './settleSentComments';
import type { GetFn, SetFn } from './types';

export const loadArtifactComments = (set: SetFn, get: GetFn) => {
  return async ({ sessionId }: { readonly sessionId: SessionId }): Promise<void> => {
    await refreshArtifactComments({ set, sessionId });
    await settleStaleSentComments({ set, get, sessionId });
  };
};
