import type { GetFn, HydrateArtifactDraftsParams, SetFn } from './types';
import { readFromStorage } from './storage';

export const hydrateArtifactDrafts = (set: SetFn, get: GetFn) => {
  return ({ sessionId }: HydrateArtifactDraftsParams): void => {
    if (get().artifactDrafts[sessionId] !== undefined) {
      return;
    }
    const drafts = readFromStorage({ sessionId });
    set((s) => ({ artifactDrafts: { ...s.artifactDrafts, [sessionId]: drafts } }));
  };
};
