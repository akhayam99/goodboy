import type { SetArtifactDraftParams, SetFn } from './types';
import { writeToStorage } from './storage';

export const setArtifactDraft = (set: SetFn) => {
  return ({ sessionId, draft }: SetArtifactDraftParams): void => {
    set((s) => {
      const next = { ...(s.artifactDrafts[sessionId] ?? {}), [draft.kind]: draft };
      writeToStorage({ sessionId, drafts: next });
      return { artifactDrafts: { ...s.artifactDrafts, [sessionId]: next } };
    });
  };
};
