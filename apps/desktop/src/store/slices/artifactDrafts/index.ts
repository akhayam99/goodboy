import { clearArtifactDraft } from './clearArtifactDraft';
import { hydrateArtifactDrafts } from './hydrateArtifactDrafts';
import { setArtifactDraft } from './setArtifactDraft';
import type { ArtifactDraftsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createArtifactDraftsSlice = ({ set, get }: SliceDeps): ArtifactDraftsSlice => ({
  artifactDrafts: {},
  setArtifactDraft: setArtifactDraft(set),
  clearArtifactDraft: clearArtifactDraft(set),
  hydrateArtifactDrafts: hydrateArtifactDrafts(set, get),
});
