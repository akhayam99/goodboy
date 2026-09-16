import { clearArtifactDraft } from './clearArtifactDraft';
import { hydrateArtifactDrafts } from './hydrateArtifactDrafts';
import { setArtifactDraft } from './setArtifactDraft';
import type { ArtifactDraftsSlice, GetFn, SetFn } from './types';

export const createArtifactDraftsSlice = (set: SetFn, get: GetFn): ArtifactDraftsSlice => ({
  artifactDrafts: {},
  setArtifactDraft: setArtifactDraft(set),
  clearArtifactDraft: clearArtifactDraft(set),
  hydrateArtifactDrafts: hydrateArtifactDrafts(set, get),
});
