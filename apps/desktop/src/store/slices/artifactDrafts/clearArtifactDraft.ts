import type { ClearArtifactDraftParams, SetFn } from './types';
import { writeToStorage } from './storage';

export const clearArtifactDraft = (set: SetFn) => {
  return ({ sessionId, kind }: ClearArtifactDraftParams): void => {
    set((s) => {
      const current = s.artifactDrafts[sessionId];
      if (current === undefined || current[kind] === undefined) {
        return s;
      }
      const next = { ...current };
      delete next[kind];
      writeToStorage({ sessionId, drafts: next });
      return { artifactDrafts: { ...s.artifactDrafts, [sessionId]: next } };
    });
  };
};
